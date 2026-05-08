import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Hardcoded config as requested
const firebaseConfig = {
  apiKey: "AIzaSyA5xnsqVwT59RgBWohNY6PatwWjJ5zFgcU",
  authDomain: "stylingwithmuskan-635f3.firebaseapp.com",
  projectId: "stylingwithmuskan-635f3",
  storageBucket: "stylingwithmuskan-635f3.firebasestorage.app",
  messagingSenderId: "1023356359588",
  appId: "1:1023356359588:web:a761cf31880d501587a731",
  measurementId: "G-5QK3HC3KL1"
};

// VAPID Key provided by user
export const VAPID_KEY = "BJxp3HhQ-Y76ows_QuMoZGfIYAqzPXIt-12t69zMXNYKJ5ojgEeMgCJ23KTlH1GVXQ4kTN9JXBWzFlzo2VyKmmo";

let messaging = null;

try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  messaging = getMessaging(app);
  console.log("[Firebase] initialized successfully with hardcoded config");
} catch (err) {
  console.error("[Firebase] Initialization failed:", err);
  messaging = null;
}

export { messaging, getToken, onMessage };
