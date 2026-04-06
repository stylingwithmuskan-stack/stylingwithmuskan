/**
 * test-fcm-token-save.mjs
 *
 * Integration test: verifies that a FCM token is saved to the DB
 * when a user logs in and calls POST /notifications/push/register.
 *
 * Run: node backend/scripts/test-fcm-token-save.mjs
 * (backend server must be running on PORT 3001)
 */

const BASE_URL = "http://localhost:3001";
const TEST_PHONE = "9990000001";
const TEST_OTP = "123456";
const FAKE_FCM_TOKEN = `test-fcm-${Date.now()}`;
const DEVICE_KEY = `test-device-${Date.now()}`;

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); process.exitCode = 1; }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function section(msg) { console.log(`\n── ${msg} ──`); }

async function post(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function get(path, token, query = "") {
  const res = await fetch(`${BASE_URL}${path}${query}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function del(path, body, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log("=".repeat(50));
  console.log("  FCM Token Save Integration Test");
  console.log("=".repeat(50));

  // ── Step 1: Health check ──
  section("Step 1: Health check");
  try {
    const res = await fetch(`${BASE_URL}/healthz`);
    const data = await res.json();
    if (data.ok) pass("Backend is running");
    else { fail("Backend health check failed"); return; }
  } catch {
    fail(`Cannot reach backend at ${BASE_URL} — is the server running?`);
    return;
  }

  // ── Step 2: Login (get JWT token) ──
  section("Step 2: Login with OTP");
  const loginRes = await post("/auth/verify-otp", {
    phone: TEST_PHONE,
    otp: TEST_OTP,
    intent: "login",
  });

  if (!loginRes.ok) {
    fail(`Login failed: ${JSON.stringify(loginRes.data)}`);
    return;
  }

  const jwt = loginRes.data.token;
  const userId = loginRes.data.user?._id;

  if (!jwt) { fail("No token in login response"); return; }
  pass(`Logged in as user ${userId} (phone: ${TEST_PHONE})`);
  info(`JWT: ${jwt.slice(0, 30)}...`);

  // ── Step 3: Register FCM token ──
  section("Step 3: Register FCM token");
  info(`FCM token: ${FAKE_FCM_TOKEN}`);
  info(`Device key: ${DEVICE_KEY}`);

  const registerRes = await post(
    "/notifications/push/register",
    {
      token: FAKE_FCM_TOKEN,
      platform: "web",
      deviceKey: DEVICE_KEY,
    },
    jwt
  );

  if (!registerRes.ok) {
    fail(`Register failed (${registerRes.status}): ${JSON.stringify(registerRes.data)}`);
    return;
  }

  const device = registerRes.data.device;
  pass("POST /notifications/push/register returned 200");

  if (device?.isActive === true) pass("device.isActive = true");
  else fail(`device.isActive expected true, got: ${device?.isActive}`);

  if (device?.permission === "granted") pass("device.permission = granted");
  else fail(`device.permission expected 'granted', got: ${device?.permission}`);

  if (device?.enabled === true) pass("device.enabled = true");
  else fail(`device.enabled expected true, got: ${device?.enabled}`);

  // ── Step 4: Verify it's in the DB via status endpoint ──
  section("Step 4: Verify token saved in DB");
  const statusRes = await get(
    "/notifications/push/status",
    jwt,
    `?deviceKey=${DEVICE_KEY}`
  );

  if (!statusRes.ok) {
    fail(`Status check failed (${statusRes.status}): ${JSON.stringify(statusRes.data)}`);
    return;
  }

  const status = statusRes.data;
  pass("GET /notifications/push/status returned 200");

  if (status.registered === true) pass("registered = true — token IS in the DB ✓");
  else fail("registered = false — token was NOT saved to DB");

  if (status.permission === "granted") pass("permission = granted");
  else fail(`permission expected 'granted', got: ${status.permission}`);

  if (status.device?.deviceKey === DEVICE_KEY) pass(`deviceKey matches: ${DEVICE_KEY}`);
  else fail(`deviceKey mismatch: expected ${DEVICE_KEY}, got ${status.device?.deviceKey}`);

  // ── Step 5: Test duplicate registration (idempotent) ──
  section("Step 5: Re-register same token (idempotent check)");
  const reRegisterRes = await post(
    "/notifications/push/register",
    { token: FAKE_FCM_TOKEN, platform: "web", deviceKey: DEVICE_KEY },
    jwt
  );
  if (reRegisterRes.ok) pass("Re-registration succeeded (upsert works correctly)");
  else fail(`Re-registration failed: ${JSON.stringify(reRegisterRes.data)}`);

  // ── Step 6: Unregister (logout cleanup) ──
  section("Step 6: Unregister token (logout simulation)");
  const unregRes = await del(
    "/notifications/push/register",
    { deviceKey: DEVICE_KEY },
    jwt
  );

  if (unregRes.ok) pass("DELETE /notifications/push/register returned 200");
  else fail(`Unregister failed: ${JSON.stringify(unregRes.data)}`);

  // ── Step 7: Verify deactivated ──
  section("Step 7: Verify token deactivated after logout");
  const afterLogoutRes = await get(
    "/notifications/push/status",
    jwt,
    `?deviceKey=${DEVICE_KEY}`
  );

  if (afterLogoutRes.data.registered === false) pass("registered = false after logout ✓");
  else fail("Token still active after logout — unregister did not work");

  // ── Summary ──
  console.log("\n" + "=".repeat(50));
  if (process.exitCode === 1) {
    console.error("  RESULT: SOME TESTS FAILED");
  } else {
    console.log("  RESULT: ALL TESTS PASSED ✅");
  }
  console.log("=".repeat(50));
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
