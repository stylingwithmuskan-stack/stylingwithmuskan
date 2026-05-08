import { messaging, getToken, onMessage } from "../firebase.js";
import { API_BASE_URL } from "../modules/user/lib/api.js";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const DEVICE_KEY_STORAGE = "swm_push_device_key";
const FCM_TOKEN_STORAGE = "swm_push_fcm_token";

function getOrCreateDeviceKey() {
  try {
    let key = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (!key) {
      key = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return `fallback-${Date.now()}`;
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("Service Workers not supported");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  // Wait for the service worker to be active before getting token
  await new Promise((resolve) => {
    if (registration.active) return resolve();
    const sw = registration.installing || registration.waiting;
    if (!sw) return resolve();
    sw.addEventListener("statechange", (e) => {
      if (e.target.state === "activated") resolve();
    });
    // Fallback timeout
    setTimeout(resolve, 3000);
  });
  return registration;
}

async function saveTokenToBackend(fcmToken, authToken) {
  // Small delay to ensure cookies/auth state is fully synced
  await new Promise(r => setTimeout(r, 1000));
  
  const deviceKey = getOrCreateDeviceKey();
  console.log("[Push] Sending registration to backend...", { deviceKey, tokenSnippet: fcmToken.slice(-6) });
  
  const res = await fetch(`${API_BASE_URL}/notifications/push/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({
      fcmToken,
      deviceKey,
      platform: "web",
      permission: "granted",
      enabled: true,
    }),
  });

  if (res.ok) {
    localStorage.setItem(FCM_TOKEN_STORAGE, fcmToken);
    console.log("[Push] ✅ STEP 7: Token saved to backend (PushDevice collection)");
  } else {
    const errData = await res.json().catch(() => ({}));
    console.error(`[Push] ❌ STEP 7 FAIL: Backend returned ${res.status}:`, errData);
    throw new Error(errData.error || `Server returned ${res.status}`);
  }
}

export async function initPushNotifications(authToken, role = "user") {
  console.log(`[Push] 🚀 Starting push notification init for role: ${role}, token present: ${!!authToken}`);

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("[Push] ❌ STEP 1 FAIL: Browser does not support notifications or service workers");
    return;
  }
  console.log("[Push] ✅ STEP 1: Browser supports notifications & service workers");

  if (!messaging) {
    console.warn("[Push] ❌ STEP 2 FAIL: Firebase messaging not initialized — check VITE_FIREBASE_* env vars");
    return;
  }
  console.log("[Push] ✅ STEP 2: Firebase messaging initialized");

  if (!VAPID_KEY) {
    console.warn("[Push] ❌ STEP 3 FAIL: VITE_FIREBASE_VAPID_KEY missing");
    return;
  }
  console.log("[Push] ✅ STEP 3: VAPID_KEY present");

  // Request permission
  const currentPermission = Notification.permission;
  console.log("[Push] STEP 4: Current notification permission:", currentPermission);

  let permission = currentPermission;
  if (currentPermission === "default") {
    permission = await Notification.requestPermission();
    console.log("[Push] STEP 4b: Permission after request:", permission);
  }

  if (permission !== "granted") {
    console.warn("[Push] ❌ STEP 4 FAIL: Notification permission not granted:", permission);
    return;
  }
  console.log("[Push] ✅ STEP 4: Permission granted");

  // Register service worker
  let swRegistration;
  try {
    swRegistration = await registerServiceWorker();
    console.log("[Push] ✅ STEP 5: Service worker registered, state:", swRegistration.active?.state);
  } catch (err) {
    console.error("[Push] ❌ STEP 5 FAIL: Service worker registration failed:", err.message);
    throw err; // Let caller know
  }

  // Get FCM token
  let fcmToken;
  try {
    fcmToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });
    console.log("[Push] FCM token obtained:", fcmToken ? fcmToken.slice(0, 20) + "..." : "null");
  } catch (err) {
    console.error("[Push] ❌ STEP 6 FAIL: getToken() failed:", err.message, err);
    throw err; // Let caller know — this is the likely failure point
  }

  if (!fcmToken) {
    console.warn("[Push] ❌ STEP 6 FAIL: getToken() returned null — Firebase may not be reachable");
    return;
  }
  console.log("[Push] ✅ STEP 6: FCM token obtained successfully");

  // Save to backend - Always register to ensure server state is in sync
  try {
    await saveTokenToBackend(fcmToken, authToken);
    console.log("[Push] ✅ STEP 7: Token saved to backend (PushDevice collection)");
  } catch (err) {
    console.error("[Push] ❌ STEP 7 FAIL: saveTokenToBackend() failed:", err.message);
    throw err;
  }
}

export async function unregisterPush(authToken, role = "user") {
  try {
    const deviceKey = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (!deviceKey) return;

    await fetch(`${API_BASE_URL}/notifications/push/register`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ deviceKey }),
    });

    localStorage.removeItem(FCM_TOKEN_STORAGE);
    console.log("[Push] Token unregistered for deviceKey:", deviceKey);
  } catch (err) {
    console.error("[Push] unregisterPush error:", err);
  }
}

const FOREGROUND_SOUND_FILES = {
  ringtone: "/sounds/ringtone.mp3",
  notification: "/sounds/massege_ting.mp3",
  emergency: "/sounds/sos_tone.mp3",
  alert: "/sounds/alert.mp3",
  success: "/sounds/massege_ting.mp3",
};

export function setupForegroundHandler(onMessageCallback) {
  if (!messaging) return;

  onMessage(messaging, (payload) => {
    if ("Notification" in window && Notification.permission === "granted") {
      const title = payload.notification?.title || "New Notification";
      const soundType = payload.data?.sound || "default";
      const isUrgent = ["ringtone", "emergency"].includes(soundType);
      const options = {
        body: payload.notification?.body || "",
        icon: payload.notification?.icon || "/logo.png",
        data: payload.data || {},
        requireInteraction: isUrgent,
        silent: false,
      };
      const notif = new Notification(title, options);
      notif.onclick = () => {
        window.focus();
        window.location.href = payload.data?.link || "/notifications";
      };

      // Play matching sound when tab is in background (foreground sounds are handled by NotificationContext)
      if (document.visibilityState === "hidden" && soundType !== "default") {
        try {
          const soundFile = FOREGROUND_SOUND_FILES[soundType];
          if (soundFile) {
            const audio = new Audio(soundFile);
            audio.volume = 1.0;
            if (isUrgent) {
              audio.loop = true;
              // Store globally so it can be stopped when user returns to tab
              window.__swm_active_ringtone__ = audio;
              setTimeout(() => {
                try { audio.pause(); audio.currentTime = 0; window.__swm_active_ringtone__ = null; } catch {}
              }, 30000);
            }
            audio.play().catch(() => {});
          }
        } catch {}
      }
    }
    if (typeof onMessageCallback === "function") onMessageCallback(payload);
  });
}
