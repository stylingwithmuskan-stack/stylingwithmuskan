import { api } from "@/modules/user/lib/api";

const DEVICE_KEY_STORAGE = "swm_push_device_key";
const TOKEN_STORAGE = "swm_push_fcm_token";
const SW_PATH = "/firebase-messaging-sw.js";

let firebaseAppPromise = null;
let foregroundUnsubscribe = null;

function getFirebaseConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };
}

function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId &&
      import.meta.env.VITE_FIREBASE_VAPID_KEY
  );
}

export function isPushSupported() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function getPushDeviceKey() {
  if (typeof window === "undefined") return "";
  try {
    let key = localStorage.getItem(DEVICE_KEY_STORAGE);
    if (!key) {
      key = `push_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return "";
  }
}

export function getStoredFcmToken() {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_STORAGE) || "";
  } catch {
    return "";
  }
}

function setStoredFcmToken(token) {
  if (typeof window === "undefined") return;
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE, token);
    else localStorage.removeItem(TOKEN_STORAGE);
  } catch {}
}

async function getFirebaseModules() {
  if (!firebaseAppPromise) {
    firebaseAppPromise = (async () => {
      const [{ initializeApp }, messagingModule] = await Promise.all([
        import("firebase/app"),
        import("firebase/messaging"),
      ]);
      return { initializeApp, messagingModule };
    })();
  }
  return firebaseAppPromise;
}

async function getMessagingBundle() {
  console.log('[Push] 📦 Loading Firebase messaging bundle...');
  
  if (!isFirebaseConfigured()) {
    console.error('[Push] ❌ Firebase web config is incomplete');
    const config = getFirebaseConfig();
    console.log('[Push] Config check:', {
      hasApiKey: !!config.apiKey,
      hasAuthDomain: !!config.authDomain,
      hasProjectId: !!config.projectId,
      hasStorageBucket: !!config.storageBucket,
      hasMessagingSenderId: !!config.messagingSenderId,
      hasAppId: !!config.appId,
      hasVapidKey: !!import.meta.env.VITE_FIREBASE_VAPID_KEY
    });
    throw new Error("Firebase web config is incomplete.");
  }
  
  const { initializeApp, messagingModule } = await getFirebaseModules();
  
  const supported = await messagingModule.isSupported();
  console.log('[Push] Firebase messaging supported:', supported);
  
  if (!supported) {
    console.error('[Push] ❌ Firebase messaging is not supported in this browser');
    throw new Error("Firebase messaging is not supported in this browser.");
  }
  
  if (!window.__swmFirebaseApp) {
    console.log('[Push] Initializing Firebase app...');
    window.__swmFirebaseApp = initializeApp(getFirebaseConfig());
    console.log('[Push] ✅ Firebase app initialized');
  }
  
  if (!window.__swmFirebaseMessaging) {
    console.log('[Push] Getting Firebase messaging instance...');
    window.__swmFirebaseMessaging = messagingModule.getMessaging(window.__swmFirebaseApp);
    console.log('[Push] ✅ Firebase messaging instance created');
  }
  
  return { messaging: window.__swmFirebaseMessaging, messagingModule };
}

export async function initializePushSupport() {
  console.log('[Push] 🔧 Initializing push support...');
  
  if (!isPushSupported()) {
    console.error('[Push] ❌ Push not supported - missing Notification or ServiceWorker API');
    return null;
  }
  
  try {
    console.log('[Push] Registering service worker:', SW_PATH);
    const registration = await navigator.serviceWorker.register(SW_PATH);
    console.log('[Push] ✅ Service worker registered:', registration.active?.scriptURL || 'pending');
    return registration;
  } catch (error) {
    console.error('[Push] ❌ Service worker registration failed:', error);
    throw error;
  }
}

export async function requestPushPermission() {
  console.log('[Push] 📱 Requesting push permission...');
  console.log('[Push] Push supported:', isPushSupported());
  
  if (!isPushSupported()) {
    console.error('[Push] ❌ Push not supported in this browser');
    return "unsupported";
  }
  
  try {
    const result = await Notification.requestPermission();
    console.log('[Push] Permission result:', result);
    return result;
  } catch (error) {
    console.error('[Push] ❌ Error requesting permission:', error);
    throw error;
  }
}

export async function getOrCreateFcmToken() {
  console.log('[Push] 🎫 Getting or creating FCM token...');
  
  try {
    const registration = await initializePushSupport();
    console.log('[Push] Service worker registration:', registration ? 'Success' : 'Failed');
    
    const { messaging, messagingModule } = await getMessagingBundle();
    console.log('[Push] Firebase messaging bundle loaded');
    
    console.log('[Push] Requesting FCM token with VAPID key...');
    const token = await messagingModule.getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    
    if (token) {
      console.log('[Push] ✅ FCM token obtained:', `${token.substring(0, 20)}...`);
      setStoredFcmToken(token);
    } else {
      console.error('[Push] ❌ No FCM token returned');
    }
    
    return token || "";
  } catch (error) {
    console.error('[Push] ❌ Error getting FCM token:', error);
    if (error && typeof error === 'object') {
      console.error('[Push] Error details:', {
        message: error.message || 'Unknown error',
        code: error.code || 'Unknown code',
        stack: error.stack || 'No stack trace'
      });
    }
    throw error;
  }
}

export async function ensurePushRegistration(role) {
  console.log('[Push] 🔐 Ensuring push registration for role:', role);
  
  if (!isPushSupported() || !isFirebaseConfigured()) {
    console.error('[Push] ❌ Push not supported or Firebase not configured');
    console.log('[Push] isPushSupported:', isPushSupported());
    console.log('[Push] isFirebaseConfigured:', isFirebaseConfigured());
    return { registered: false, reason: "unsupported" };
  }
  
  console.log('[Push] Current permission:', Notification.permission);
  if (Notification.permission !== "granted") {
    console.error('[Push] ❌ Permission not granted');
    return { registered: false, reason: "permission" };
  }
  
  try {
    console.log('[Push] Getting or creating FCM token...');
    const token = await getOrCreateFcmToken();
    console.log('[Push] FCM Token:', token ? `${token.substring(0, 20)}...` : 'null');
    
    if (!token) {
      console.error('[Push] ❌ Failed to get FCM token');
      return { registered: false, reason: "token" };
    }
    
    const deviceKey = getPushDeviceKey();
    console.log('[Push] Device Key:', deviceKey);
    
    console.log('[Push] Registering with backend API...');
    const response = await api.notifications.push.register(
      {
        fcmToken: token,
        deviceKey,
        platform: "web",
        permission: Notification.permission,
        enabled: true,
      },
      { role }
    );
    
    console.log('[Push] ✅ Backend registration successful:', response);
    return { registered: true, token, deviceKey, response };
  } catch (error) {
    console.error('[Push] ❌ Error during registration:', error);
    if (error && typeof error === 'object') {
      console.error('[Push] Error details:', {
        message: error.message || 'Unknown error',
        stack: error.stack || 'No stack trace'
      });
    }
    throw error;
  }
}

export async function revokePushRegistration(role) {
  const deviceKey = getPushDeviceKey();
  if (!deviceKey) return { success: true };
  try {
    return await api.notifications.push.unregister(
      {
        deviceKey,
        fcmToken: getStoredFcmToken(),
      },
      { role }
    );
  } catch {
    return { success: false };
  }
}

export async function syncPushPreferences(role, enabled) {
  const deviceKey = getPushDeviceKey();
  if (!deviceKey) return { success: false };
  return api.notifications.push.preferences(
    {
      deviceKey,
      enabled,
      permission: typeof Notification === "undefined" ? "default" : Notification.permission,
    },
    { role }
  );
}

export async function fetchPushStatus(role) {
  const deviceKey = getPushDeviceKey();
  if (!deviceKey) return { supported: isPushSupported(), registered: false, permission: "default" };
  try {
    return await api.notifications.push.status(deviceKey, { role });
  } catch {
    return {
      supported: isPushSupported(),
      registered: false,
      permission: typeof Notification === "undefined" ? "default" : Notification.permission,
    };
  }
}

export async function setupForegroundPushListener(handler) {
  if (!isPushSupported() || !isFirebaseConfigured()) return () => {};
  const { messaging, messagingModule } = await getMessagingBundle();
  if (foregroundUnsubscribe) foregroundUnsubscribe();
  foregroundUnsubscribe = messagingModule.onMessage(messaging, (payload) => {
    if (handler) handler(payload);
  });
  return () => {
    if (foregroundUnsubscribe) foregroundUnsubscribe();
    foregroundUnsubscribe = null;
  };
}
