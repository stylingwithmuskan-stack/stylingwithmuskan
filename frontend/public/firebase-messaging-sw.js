/* global importScripts, firebase, clients */

importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA5xnsqVwT59RgBWohNY6PatwWjJ5zFgcU",
  authDomain: "stylingwithmuskan-635f3.firebaseapp.com",
  projectId: "stylingwithmuskan-635f3",
  storageBucket: "stylingwithmuskan-635f3.firebasestorage.app",
  messagingSenderId: "1023356359588",
  appId: "1:1023356359588:web:a761cf31880d501587a731",
  measurementId: "G-5QK3HC3KL1",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || "Styling With Muskan";
  const body = payload?.notification?.body || payload?.data?.body || "You have a new update.";
  const link = payload?.data?.link || "/notifications";
  const icon = payload?.notification?.icon || payload?.data?.icon || "/logo.png";

  self.registration.showNotification(title, {
    body,
    icon,
    data: { link },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.link || "/notifications";
  const absoluteTarget = target.startsWith("http") ? target : `${self.location.origin}${target.startsWith("/") ? target : `/${target}`}`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === absoluteTarget && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(absoluteTarget);
      return undefined;
    })
  );
});
