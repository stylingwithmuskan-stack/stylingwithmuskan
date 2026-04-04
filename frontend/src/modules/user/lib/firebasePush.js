import { api } from "@/modules/user/lib/api";
import { safeStorage } from "@/modules/user/lib/safeStorage";

const DEVICE_KEY_STORAGE = "swm_push_device_key";
const TOKEN_STORAGE = "swm_push_fcm_token";
const SW_PATH = "/firebase-messaging-sw.js";

let firebaseAppPromise = null;
let foregroundUnsubscribe = null;

/**
 * Detect if running in iOS in-app browser (Google, Instagram, Facebook, etc.)
 */
function isIOSInAppBrowser() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  
  const ua = navigator.userAgent || navigator.vendor || window.opera || "";
  
  // Detect iOS
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  
  // Detect in-app browsers (Google, Instagram, Facebook, Line, Snapchat, Twitter, WhatsApp)
  const isInApp = /FBAN|FBAV|Instagram|GSA|Line|Snapchat|Twitter|WhatsApp|LinkedIn/.test(ua);
  
  return isIOS && isInApp;
}

/**
 * Check if we're in a restricted WebView environment
 */
function isRestrictedWebView() {
  try {
    const test = '__webview_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return false;
  } catch {
    return true;
  }
}

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
    let key = safeStorage.getItem(DEVICE_KEY_STORAGE);
    if (!key) {
      key = `push_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      safeStorage.setItem(DEVICE_KEY_STORAGE, key);
    }
    return key;
  } catch {
    return "";
  }
}

export function setPushDeviceKey(key) {
  if (typeof window === "undefined") return;
  try {
    if (key) safeStorage.setItem(DEVICE_KEY_STORAGE, key);
  } catch {}
}

export function getStoredFcmToken() {
  if (typeof window === "undefined") return "";
  try {
    return safeStorage.getItem(TOKEN_STORAGE) || "";
  } catch {
    return "";
  }
}

function setStoredFcmToken(token) {
  if (typeof window === "undefined") return;
  try {
    if (token) safeStorage.setItem(TOKEN_STORAGE, token);
    else safeStorage.removeItem(TOKEN_STORAGE);
  } catch {}
}

async function deriveDeviceKeyFromToken(token) {
  if (!token || typeof window === "undefined") return "";
  try {
    if (!window.crypto?.subtle) return "";
    const enc = new TextEncoder().encode(token);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", enc);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return `fcm_${hashHex.slice(0, 32)}`;
  } catch {
    return "";
  }
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
  
  // Skip Firebase in restricted environments (iOS in-app browsers)
  if (isIOSInAppBrowser()) {
    console.warn('[Push] ⚠️ Skipping Firebase in iOS in-app browser');
    throw new Error('Firebase not supported in iOS in-app browser');
  }
  
  if (isRestrictedWebView()) {
    console.warn('[Push] ⚠️ Skipping Firebase in restricted WebView');
    throw new Error('Firebase not supported in restricted WebView');
  }
  
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
  
  try {
    const { initializeApp, messagingModule } = await getFirebaseModules();
    
    const supported = await messagingModule.isSupported();
    console.log('[Push] Firebase messaging supported:', supported);
    
    if (!supported) {
      console.error('[Push] ❌ Firebase messaging is not supported in this browser');
      throw new Error("Firebase messaging is not supported in this browser.");
    }
    
    // Use getApps() to prevent duplicate initialization
    const { getApps } = await import("firebase/app");
    const existingApps = getApps();
    
    if (!window.__swmFirebaseApp) {
      if (existingApps.length === 0) {
        console.log('[Push] Initializing Firebase app...');
        window.__swmFirebaseApp = initializeApp(getFirebaseConfig());
        console.log('[Push] ✅ Firebase app initialized');
      } else {
        console.log('[Push] Using existing Firebase app');
        window.__swmFirebaseApp = existingApps[0];
      }
    }
    
    if (!window.__swmFirebaseMessaging) {
      console.log('[Push] Getting Firebase messaging instance...');
      window.__swmFirebaseMessaging = messagingModule.getMessaging(window.__swmFirebaseApp);
      console.log('[Push] ✅ Firebase messaging instance created');
    }
    
    return { messaging: window.__swmFirebaseMessaging, messagingModule };
  } catch (error) {
    console.error('[Push] ❌ Firebase initialization failed:', error);
    throw error;
  }
}

export async function initializePushSupport() {
  console.log('[Push] 🔧 Initializing push support...');
  
  if (!isPushSupported()) {
    console.error('[Push] ❌ Push not supported - missing Notification or ServiceWorker API');
    return null;
  }
  
  try {
    console.log('[Push] Registering service worker:', SW_PATH);
    await navigator.serviceWorker.register(SW_PATH);
    const ready = await navigator.serviceWorker.ready;
    console.log('[Push] ✅ Service worker ready:', ready.active?.scriptURL || 'pending');
    return ready;
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
      if (error.name === "AbortError") {
        console.error('[Push] Hint: Browser push service blocked. In Brave, enable "Use Google Services for Push Messaging" (brave://settings/privacy) and disable Shields for localhost.');
      }
    }
    throw error;
  }
}

export async function ensurePushRegistration(role) {
  console.log('[Push] 🔐 Ensuring push registration for role:', role);
  
  // Gracefully skip in restricted environments
  if (isIOSInAppBrowser()) {
    console.warn('[Push] ⚠️ Push notifications not available in iOS in-app browser');
    return { registered: false, reason: "ios_inapp_browser" };
  }
  
  if (isRestrictedWebView()) {
    console.warn('[Push] ⚠️ Push notifications not available in restricted WebView');
    return { registered: false, reason: "restricted_webview" };
  }
  
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

    const derivedKey = await deriveDeviceKeyFromToken(token);
    if (derivedKey) setPushDeviceKey(derivedKey);
    const deviceKey = derivedKey || getPushDeviceKey();
    console.log('[Push] Device Key:', deviceKey);

    console.log('[Push] Registering with backend API...');
    const response = await api.fcmTokens.save(role, token, "web");
    
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
  const token = getStoredFcmToken();
  if (!token) return { success: true };
  try {
    const res = await api.fcmTokens.remove(role, token, "web");
    setStoredFcmToken("");
    return res;
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
