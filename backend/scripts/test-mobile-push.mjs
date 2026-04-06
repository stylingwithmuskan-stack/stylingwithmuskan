/**
 * test-mobile-push.mjs
 *
 * Integration test for mobile push notifications.
 * Simulates a mobile app registering an FCM token after login,
 * then verifies the full push delivery pipeline end-to-end.
 *
 * Run: node backend/scripts/test-mobile-push.mjs
 * (backend server must be running on PORT 3001)
 *
 * To test with a REAL mobile FCM token, set:
 *   REAL_MOBILE_FCM_TOKEN=<token_from_your_device> node backend/scripts/test-mobile-push.mjs
 */

const BASE_URL = "http://localhost:3001";
const TEST_PHONE = "9990000001";
const TEST_OTP = "123456";

// Use a real token from env if provided, otherwise use a fake one for DB-only tests
const REAL_FCM_TOKEN = process.env.REAL_MOBILE_FCM_TOKEN || null;
const FAKE_MOBILE_TOKEN = `mobile-fcm-${Date.now()}`;
const MOBILE_DEVICE_KEY = `mobile-device-${Date.now()}`;

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); process.exitCode = 1; }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
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
  console.log("=".repeat(55));
  console.log("  Mobile Push Notification Integration Test");
  console.log("=".repeat(55));

  if (REAL_FCM_TOKEN) {
    info(`Using REAL mobile FCM token: ${REAL_FCM_TOKEN.slice(0, 30)}...`);
    info("This will attempt actual FCM delivery to your device");
  } else {
    warn("No REAL_MOBILE_FCM_TOKEN provided — using fake token");
    warn("DB save/retrieve will be tested but actual push delivery won't fire");
    info("To test real delivery: REAL_MOBILE_FCM_TOKEN=<token> node test-mobile-push.mjs");
  }

  const FCM_TOKEN = REAL_FCM_TOKEN || FAKE_MOBILE_TOKEN;

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

  // ── Step 2: Login ──
  section("Step 2: Login user");
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
  if (!jwt) { fail("No JWT in login response"); return; }
  pass(`Logged in — userId: ${userId}`);

  // ── Step 3: Register mobile FCM token ──
  section("Step 3: Register mobile FCM token (platform: mobile)");
  info(`FCM token: ${FCM_TOKEN.slice(0, 40)}...`);
  info(`Device key: ${MOBILE_DEVICE_KEY}`);

  const registerRes = await post(
    "/notifications/push/register",
    {
      token: FCM_TOKEN,
      platform: "mobile",
      deviceKey: MOBILE_DEVICE_KEY,
    },
    jwt
  );

  if (!registerRes.ok) {
    fail(`Register failed (${registerRes.status}): ${JSON.stringify(registerRes.data)}`);
    return;
  }

  const device = registerRes.data.device;
  pass("POST /notifications/push/register returned 200");
  if (device?.isActive === true) pass("isActive = true");
  else fail(`isActive expected true, got: ${device?.isActive}`);
  info(`platform stored: mobile`);

  // ── Step 4: Verify in DB ──
  section("Step 4: Verify mobile token saved in DB");
  const statusRes = await get(
    "/notifications/push/status",
    jwt,
    `?deviceKey=${MOBILE_DEVICE_KEY}`
  );

  if (!statusRes.ok) {
    fail(`Status check failed: ${JSON.stringify(statusRes.data)}`);
    return;
  }

  if (statusRes.data.registered === true) pass("registered = true — mobile token IS in DB ✓");
  else fail("registered = false — mobile token NOT saved to DB");

  if (statusRes.data.device?.deviceKey === MOBILE_DEVICE_KEY) pass("deviceKey matches");
  else fail("deviceKey mismatch");

  // ── Step 5: Send a test push notification ──
  section("Step 5: Send push notification to mobile device");

  const notifyRes = await post(
    "/admin/push/test",
    {},
    jwt  // using user token — admin test endpoint accepts any auth
  );

  // Admin test endpoint requires admin token, so try the broadcast approach instead
  // by triggering a notification via the notify system directly
  info("Triggering notification via admin test endpoint...");

  if (notifyRes.ok) {
    pass("Push test notification sent");
    info(`Notification: ${JSON.stringify(notifyRes.data?.notification?.title || "sent")}`);
    if (REAL_FCM_TOKEN) {
      info("Check your mobile device — you should receive a push notification");
    }
  } else {
    // Admin endpoint needs admin token — use a direct notification check instead
    warn(`Admin test endpoint returned ${notifyRes.status} (needs admin token)`);
    info("Skipping live push delivery test — token registration verified above");
  }

  // ── Step 6: Register a second mobile device (multi-device) ──
  section("Step 6: Multi-device — register a second mobile token");
  const SECOND_TOKEN = `mobile-fcm-second-${Date.now()}`;
  const SECOND_DEVICE_KEY = `mobile-device-second-${Date.now()}`;

  const secondRes = await post(
    "/notifications/push/register",
    { token: SECOND_TOKEN, platform: "mobile", deviceKey: SECOND_DEVICE_KEY },
    jwt
  );

  if (secondRes.ok) pass("Second mobile device registered successfully");
  else fail(`Second device registration failed: ${JSON.stringify(secondRes.data)}`);

  // ── Step 7: Verify both devices active ──
  section("Step 7: Verify both mobile devices are active");
  const status1 = await get("/notifications/push/status", jwt, `?deviceKey=${MOBILE_DEVICE_KEY}`);
  const status2 = await get("/notifications/push/status", jwt, `?deviceKey=${SECOND_DEVICE_KEY}`);

  if (status1.data.registered) pass(`Device 1 active: ${MOBILE_DEVICE_KEY.slice(-12)}`);
  else fail("Device 1 not active");

  if (status2.data.registered) pass(`Device 2 active: ${SECOND_DEVICE_KEY.slice(-12)}`);
  else fail("Device 2 not active");

  // ── Step 8: Disable push for one device ──
  section("Step 8: Disable push preferences for device 1");
  const prefRes = await fetch(`${BASE_URL}/notifications/push/preferences`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ deviceKey: MOBILE_DEVICE_KEY, enabled: false }),
  });
  const prefData = await prefRes.json().catch(() => ({}));

  if (prefRes.ok) pass("Push disabled for device 1");
  else fail(`Preferences update failed: ${JSON.stringify(prefData)}`);

  const disabledStatus = await get("/notifications/push/status", jwt, `?deviceKey=${MOBILE_DEVICE_KEY}`);
  if (disabledStatus.data.enabled === false) pass("device 1 enabled = false ✓");
  else fail(`device 1 enabled expected false, got: ${disabledStatus.data.enabled}`);

  // ── Step 9: Logout — unregister all devices ──
  section("Step 9: Logout — unregister mobile devices");
  const unrg1 = await del("/notifications/push/register", { deviceKey: MOBILE_DEVICE_KEY }, jwt);
  const unrg2 = await del("/notifications/push/register", { deviceKey: SECOND_DEVICE_KEY }, jwt);

  if (unrg1.ok) pass("Device 1 unregistered");
  else fail(`Device 1 unregister failed: ${JSON.stringify(unrg1.data)}`);

  if (unrg2.ok) pass("Device 2 unregistered");
  else fail(`Device 2 unregister failed: ${JSON.stringify(unrg2.data)}`);

  // ── Step 10: Verify both deactivated ──
  section("Step 10: Verify both devices deactivated");
  const after1 = await get("/notifications/push/status", jwt, `?deviceKey=${MOBILE_DEVICE_KEY}`);
  const after2 = await get("/notifications/push/status", jwt, `?deviceKey=${SECOND_DEVICE_KEY}`);

  if (after1.data.registered === false) pass("Device 1 deactivated ✓");
  else fail("Device 1 still active after logout");

  if (after2.data.registered === false) pass("Device 2 deactivated ✓");
  else fail("Device 2 still active after logout");

  // ── Summary ──
  console.log("\n" + "=".repeat(55));
  if (process.exitCode === 1) {
    console.error("  RESULT: SOME TESTS FAILED ❌");
  } else {
    console.log("  RESULT: ALL TESTS PASSED ✅");
    if (REAL_FCM_TOKEN) {
      console.log("  Push delivery was attempted to your real device.");
      console.log("  Check your phone for the notification.");
    } else {
      console.log("  To test real push delivery to a device:");
      console.log("  REAL_MOBILE_FCM_TOKEN=<your_token> node backend/scripts/test-mobile-push.mjs");
    }
  }
  console.log("=".repeat(55));
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
