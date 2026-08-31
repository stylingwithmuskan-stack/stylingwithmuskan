// firebase-messaging-sw.js
// Service worker for Firebase Cloud Messaging background notifications

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyA5xnsqVwT59RgBWohNY6PatwWjJ5zFgcU",
  authDomain: "stylingwithmuskan-635f3.firebaseapp.com",
  projectId: "stylingwithmuskan-635f3",
  storageBucket: "stylingwithmuskan-635f3.firebasestorage.app",
  messagingSenderId: "1023356359588",
  appId: "1:1023356359588:web:a761cf31880d501587a731",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Sound file mapping
const SOUND_FILES = {
  ringtone: "/sounds/ringtone.mp3",
  emergency: "/sounds/sos_tone.mp3",
  alert: "/sounds/alert.mp3",
  notification: "/sounds/massege_ting.mp3",
  success: "/sounds/massege_ting.mp3",
};

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "New Notification";
  const body = payload.notification?.body || payload.data?.body || "";
  const soundType = payload.data?.sound || "notification";
  const isUrgent = ["ringtone", "emergency"].includes(soundType);

  const soundFile = SOUND_FILES[soundType] || SOUND_FILES.notification;

  const options = {
    body,
    icon: payload.notification?.icon || "/logo.png",
    badge: "/logo.png",
    vibrate: isUrgent
      ? [300, 100, 300, 100, 300, 100, 300, 100, 300]  // Long urgent vibration
      : [200, 100, 200],                                 // Standard vibration
    data: { ...(payload.data || {}), soundType, soundFile },
    tag: isUrgent ? "urgent-ringtone" : (payload.data?.notificationId || "general"),
    renotify: true,
    requireInteraction: isUrgent,
    silent: false,
    sound: soundFile,  // Some browsers respect this
  };

  self.registration.showNotification(title, options);

  // Notify all open app windows to play the sound
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: "PLAY_SOUND",
        soundType: soundType,
        soundFile: soundFile,
        isUrgent: isUrgent,
      });
    });
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/notifications";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(link);
      })
  );
});
