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
  const deviceKey = getOrCreateDeviceKey();
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
    console.log("[Push] ✅ FCM token saved to DB, deviceKey:", deviceKey);
  } else {
    const err = await res.json().catch(() => ({}));
    console.error("[Push] ❌ Failed to save token to DB:", err);
  }
}

export async function initPushNotifications(authToken, role = "user") {
  try {
    console.log("[Push] Starting push notification init for role:", role);

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.warn("[Push] Browser does not support notifications or service workers");
      return;
    }

    if (!messaging) {
      console.warn("[Push] Firebase messaging not initialized — check VITE_FIREBASE_* env vars");
      return;
    }

    if (!VAPID_KEY) {
      console.warn("[Push] VITE_FIREBASE_VAPID_KEY missing");
      return;
    }

    // Request permission
    const currentPermission = Notification.permission;
    console.log("[Push] Current notification permission:", currentPermission);

    let permission = currentPermission;
    if (currentPermission === "default") {
      permission = await Notification.requestPermission();
      console.log("[Push] Permission after request:", permission);
    }

    if (permission !== "granted") {
      console.warn("[Push] Notification permission not granted:", permission);
      return;
    }

    // Register service worker
    let swRegistration;
    try {
      swRegistration = await registerServiceWorker();
      console.log("[Push] ✅ Service worker registered, state:", swRegistration.active?.state);
    } catch (err) {
      console.error("[Push] ❌ Service worker registration failed:", err.message);
      return;
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
      console.error("[Push] ❌ getToken() failed:", err.message);
      return;
    }

    if (!fcmToken) {
      console.warn("[Push] getToken() returned null — Firebase may not be reachable");
      return;
    }

    // Skip if token hasn't changed
    const previousToken = localStorage.getItem(FCM_TOKEN_STORAGE);
    if (previousToken === fcmToken) {
      console.log("[Push] Token unchanged, skipping re-registration");
      return;
    }

    // Save to backend
    await saveTokenToBackend(fcmToken, authToken);
  } catch (err) {
    console.error("[Push] initPushNotifications unexpected error:", err);
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
