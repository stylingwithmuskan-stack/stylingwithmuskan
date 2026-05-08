import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Notification from "../models/Notification.js";
import PushDevice from "../models/PushDevice.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";
import {
  PUSH_DEFAULT_CLICK_BASE_URL,
  PUSH_BATCH_SIZE,
  PUSH_RETRY_LIMIT,
} from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Firebase init (singleton)
// ---------------------------------------------------------------------------

export let pushEnabled = false;

(function initFirebase() {
  const serviceAccountPath = path.resolve(__dirname, "../config/stylingwithmuskan-635f3-firebase-adminsdk-fbsvc-1124a7e333.json").trim();
  console.log(`[push] 🏁 initFirebase called. Path: ${serviceAccountPath}`);

  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`[push] ❌ CRITICAL: Service account file NOT found at: "${serviceAccountPath}"`);
    pushEnabled = false;
    return;
  }

  try {
    if (admin.apps.length === 0) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      console.log(`[push] ✅ Firebase Admin initialized successfully using JSON for project: ${serviceAccount.project_id}`);
      pushEnabled = true;
    } else {
      pushEnabled = true;
    }
  } catch (err) {
    console.error("[push] ❌ Firebase Admin initialization error:", err.message);
    pushEnabled = false;
  }
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withinWindow(now, startTime, endTime) {
  const [startH, startM] = String(startTime || "07:00").split(":").map(Number);
  const [endH, endM] = String(endTime || "22:00").split(":").map(Number);
  if (Number.isNaN(startH) || Number.isNaN(endH)) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = startH * 60 + (startM || 0);
  const end = endH * 60 + (endM || 0);
  if (start === end) return true;
  if (end > start) return mins >= start && mins <= end;
  return mins >= start || mins <= end;
}

export async function isWithinProviderPushWindow() {
  try {
    const office = await OfficeSettings.findOne().lean();
    const bookingSettings = await BookingSettings.findOne().lean();
    return withinWindow(
      new Date(),
      bookingSettings?.providerNotificationStartTime || office?.startTime || "07:00",
      bookingSettings?.providerNotificationEndTime || office?.endTime || "22:00"
    );
  } catch {
    return true;
  }
}

function normalizeLink(link = "") {
  const safe = String(link || "").trim();
  if (!safe) return `${PUSH_DEFAULT_CLICK_BASE_URL.replace(/\/$/, "")}/notifications`;
  if (/^https?:\/\//i.test(safe)) return safe;
  return `${PUSH_DEFAULT_CLICK_BASE_URL.replace(/\/$/, "")}${safe.startsWith("/") ? safe : `/${safe}`}`;
}

export function buildNotificationLink({ recipientRole, type, meta = {} }) {
  const bookingId = meta?.bookingId ? String(meta.bookingId) : "";
  const enquiryId = meta?.enquiryId ? String(meta.enquiryId) : "";

  if (recipientRole === "user") {
    if (type.startsWith("payment_")) return "/payment";
    if (type.startsWith("custom_") && enquiryId) return `/bookings?enquiry=${enquiryId}`;
    if (bookingId) return `/bookings`;
    return "/notifications";
  }
  if (recipientRole === "provider") {
    if (type === "provider_admin_approved" || type === "provider_vendor_approved" || type === "provider_rejected") return "/provider/profile";
    if (type === "leave_approved" || type === "leave_rejected") return "/provider/profile";
    if (type === "zone_added") return "/provider/all-zones";
    if (bookingId) return `/provider/bookings`;
    return "/provider/notifications";
  }
  if (recipientRole === "vendor") {
    if (type === "sos_alert") return "/vender/sos";
    if (type.startsWith("custom_")) return "/vender/bookings";
    if (bookingId) return "/vender/bookings";
    return "/vender/notifications";
  }
  if (recipientRole === "admin") {
    if (type === "sos_alert") return "/admin/sos";
    if (type === "leave_requested") return "/admin/sp";
    if (type.includes("vendor")) return "/admin/vendors";
    if (type.includes("provider")) return "/admin/sp";
    if (bookingId) return "/admin/bookings";
    return "/admin/notifications";
  }
  return "/notifications";
}

async function deactivateToken(fcmToken, error) {
  await PushDevice.updateOne(
    { fcmToken },
    { $set: { isActive: false, lastError: String(error) } }
  );
}

// ---------------------------------------------------------------------------
// buildFCMPayload
// ---------------------------------------------------------------------------

export function buildFCMPayload(notification) {
  const title = String(notification.title || "").slice(0, 100);
  const body = String(notification.message || "").slice(0, 200);
  const link = normalizeLink(notification.link);
  const sound = notification.sound || "default";
  const isUrgent = ["ringtone", "emergency", "alert", "success"].includes(sound);

  return {
    notification: { 
        title, 
        body
    },
    android: {
      priority: "high",
      notification: {
        sound: sound === "default" ? "default" : sound,
        channelId: "high_priority_notifications",
        icon: "notification_icon",
        color: "#9333ea",
        priority: "max",
        visibility: "public",
        notification_priority: "PRIORITY_HIGH",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: sound === "default" ? "default" : `${sound}.caf`,
          badge: 1,
          critical: isUrgent,
        },
      },
      headers: {
        "apns-priority": "10",
      }
    },
    webpush: {
      notification: {
        icon: "/logo.png",
        badge: "/logo.png",
        vibrate: isUrgent ? [300, 100, 300, 100, 300, 100, 300] : [200, 100, 200],
        requireInteraction: isUrgent,
        silent: false,
      },
      fcmOptions: {
        link: String(link),
      },
      headers: {
        Urgency: isUrgent ? "high" : "normal",
      },
    },
    data: {
      notificationId: String(notification._id),
      link: String(link),
      type: String(notification.type),
      role: String(notification.recipientRole),
      sound: String(sound),
      click_action: "FLUTTER_NOTIFICATION_CLICK", 
    },
  };
}

// ---------------------------------------------------------------------------
// sendPushForNotification
// ---------------------------------------------------------------------------

export async function sendPushForNotification(notification) {
  if (!pushEnabled) {
    await Notification.updateOne(
      { _id: notification._id },
      { $set: { "delivery.push.status": "disabled" } }
    );
    return { sent: 0, failed: 0 };
  }

  if ((notification.delivery?.push?.failureCount ?? 0) >= PUSH_RETRY_LIMIT) {
    await Notification.updateOne(
      { _id: notification._id },
      { $set: { "delivery.push.status": "failed" } }
    );
    return { sent: 0, failed: 0 };
  }

  if (notification.recipientRole === "provider") {
    const inWindow = await isWithinProviderPushWindow();
    if (!inWindow) {
      await queuePushForNotification(notification, "Provider quiet hours");
      return { sent: 0, failed: 0 };
    }
  }

  const devices = await PushDevice.find({
    recipientId: notification.recipientId,
    isActive: true,
    "preferences.enabled": true,
  }).lean();

  if (!devices.length) {
    console.warn(`[push] No active push devices found for recipient: ${notification.recipientId}`);
    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          "delivery.push.status": "failed",
          "delivery.push.lastAttemptAt": new Date(),
          "delivery.push.lastError": "No active devices",
        },
        $inc: { "delivery.push.failureCount": 1 },
      }
    );
    return { sent: 0, failed: 0 };
  }

  console.log(`[push] Found ${devices.length} devices for recipient ${notification.recipientId}. Sending FCM...`);
  const payload = buildFCMPayload(notification);
  // Unique tokens only to avoid duplicates
  const tokens = [...new Set(devices.map((d) => d.fcmToken))];

  let totalSent = 0;
  let totalFailed = 0;

  for (let i = 0; i < tokens.length; i += PUSH_BATCH_SIZE) {
    const batch = tokens.slice(i, i + PUSH_BATCH_SIZE);
    try {
      const response = await admin.messaging().sendEachForMulticast({
        ...payload,
        tokens: batch,
      });

      console.log(`[push] FCM Batch response: success=${response.successCount}, failure=${response.failureCount}`);
      
      for (let j = 0; j < response.responses.length; j++) {
        const res = response.responses[j];
        if (res.success) {
          totalSent++;
        } else {
          totalFailed++;
          const code = res.error?.code;
          const message = res.error?.message;
          console.error(`[push] Token ${batch[j].slice(-6)} failed. Code: ${code}, Message: ${message}`);
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            await deactivateToken(batch[j], code);
          }
        }
      }
    } catch (err) {
      totalFailed += batch.length;
      console.error("[push] sendEachForMulticast error:", err);
    }
  }

  const now = new Date();
  const statusUpdate = {
    "delivery.push.status": totalSent > 0 ? "sent" : "failed",
    "delivery.push.lastAttemptAt": now,
    "delivery.push.failureCount": (notification.delivery?.push?.failureCount ?? 0) + totalFailed,
  };
  if (totalSent > 0) {
    statusUpdate["delivery.push.sentAt"] = now;
  }
  if (totalSent === 0 && totalFailed > 0) {
    statusUpdate["delivery.push.lastError"] = "All tokens failed";
  }

  await Notification.updateOne({ _id: notification._id }, { $set: statusUpdate });

  return { sent: totalSent, failed: totalFailed };
}

// ---------------------------------------------------------------------------
// queuePushForNotification
// ---------------------------------------------------------------------------

export async function queuePushForNotification(notification, reason = "") {
  await Notification.updateOne(
    { _id: notification._id },
    {
      $set: {
        "delivery.push.status": "queued",
        "delivery.push.lastError": reason,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// processQueuedPushNotifications
// ---------------------------------------------------------------------------

export async function processQueuedPushNotifications() {
  if (!pushEnabled) return;
  const inWindow = await isWithinProviderPushWindow();
  if (!inWindow) return;

  const queued = await Notification.find({
    "delivery.push.status": "queued",
    recipientRole: "provider",
  })
    .limit(50)
    .lean();

  for (const notification of queued) {
    await sendPushForNotification(notification);
  }
}

// ---------------------------------------------------------------------------
// enforceDeviceLimit
// ---------------------------------------------------------------------------

export async function enforceDeviceLimit(recipientId, recipientRole) {
  const devices = await PushDevice.find(
    { recipientId, recipientRole, isActive: true },
    { _id: 1, lastSeenAt: 1 }
  )
    .sort({ lastSeenAt: 1 })
    .lean();

  if (devices.length <= 10) return;

  const excess = devices.length - 10;
  const oldestIds = devices.slice(0, excess).map((d) => d._id);

  await PushDevice.updateMany(
    { _id: { $in: oldestIds } },
    { $set: { isActive: false } }
  );
}

// ---------------------------------------------------------------------------
// isDuplicatePush
// ---------------------------------------------------------------------------

export async function isDuplicatePush(recipientId, dedupeKey, windowMs) {
  const doc = await Notification.findOne({
    recipientId,
    "meta.dedupeKey": dedupeKey,
    createdAt: { $gte: new Date(Date.now() - windowMs) },
  }).lean();
  return doc !== null;
}
