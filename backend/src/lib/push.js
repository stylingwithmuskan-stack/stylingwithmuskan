import Notification from "../models/Notification.js";
import PushDevice from "../models/PushDevice.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";
import {
  PUSH_BATCH_SIZE,
  PUSH_DEFAULT_CLICK_BASE_URL,
  PUSH_DEFAULT_ICON_URL,
  PUSH_RETRY_LIMIT,
} from "../config.js";
import { sendFirebasePush, isFirebaseConfigured } from "./firebaseAdmin.js";

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

export async function sendPushForNotification(notification) {
  if (!notification?.recipientId || !notification?.recipientRole) return { sent: 0, failed: 0 };

  if (!isFirebaseConfigured()) {
    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          "delivery.push.status": "disabled",
          "delivery.push.lastError": "Firebase admin not configured",
        },
      }
    );
    return { sent: 0, failed: 0 };
  }

  const devices = await PushDevice.find({
    recipientId: String(notification.recipientId),
    recipientRole: notification.recipientRole,
    isActive: true,
    "preferences.enabled": { $ne: false },
  }).lean();

  if (!devices.length) {
    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          "delivery.push.status": "disabled",
          "delivery.push.lastError": "No active push devices",
        },
      }
    );
    return { sent: 0, failed: 0 };
  }

  const now = new Date();
  const tokens = devices.map((device) => device.fcmToken).filter(Boolean);
  const response = await sendFirebasePush({
    tokens,
    title: notification.title,
    body: notification.message,
    icon: notification.meta?.icon || PUSH_DEFAULT_ICON_URL,
    data: {
      link: normalizeLink(notification.link),
      notificationId: notification._id.toString(),
      recipientRole: notification.recipientRole,
      type: notification.type,
    },
  });

  const failedTokens = [];
  const invalidTokens = [];
  response.responses.forEach((item, index) => {
    if (!item.success) {
      const token = tokens[index];
      failedTokens.push(token);
      const code = item.error?.code || "";
      if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token")) {
        invalidTokens.push(token);
      }
    }
  });

  if (invalidTokens.length) {
    await PushDevice.updateMany(
      { fcmToken: { $in: invalidTokens } },
      {
        $set: {
          isActive: false,
          lastError: "FCM token invalidated",
        },
        $inc: { failureCount: 1 },
      }
    );
  }

  if (failedTokens.length) {
    await PushDevice.updateMany(
      { fcmToken: { $in: failedTokens } },
      {
        $set: { lastError: "FCM push failed" },
        $inc: { failureCount: 1 },
      }
    );
  }

  if (response.successCount) {
    await PushDevice.updateMany(
      { fcmToken: { $in: tokens.filter((token) => !failedTokens.includes(token)) } },
      {
        $set: {
          lastSuccessAt: now,
          lastError: "",
          lastSeenAt: now,
        },
      }
    );
  }

  await Notification.updateOne(
    { _id: notification._id },
    {
      $set: {
        "delivery.push.status": response.failureCount > 0 ? "failed" : "sent",
        "delivery.push.lastAttemptAt": now,
        "delivery.push.sentAt": response.successCount > 0 ? now : null,
        "delivery.push.lastError": response.failureCount > 0 ? "One or more push deliveries failed" : "",
      },
      ...(response.failureCount > 0 ? { $inc: { "delivery.push.failureCount": 1 } } : {}),
    }
  );

  return { sent: response.successCount || 0, failed: response.failureCount || 0 };
}

export async function queuePushForNotification(notification, reason = "Queued for later delivery") {
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

export async function processQueuedPushNotifications() {
  if (!isFirebaseConfigured()) return;
  const queue = await Notification.find({
    $or: [
      { "delivery.push.status": "queued" },
      { "delivery.push.status": "failed" },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(PUSH_BATCH_SIZE)
    .lean();

  if (!queue.length) return;

  const providerWindowOpen = await isWithinProviderPushWindow();

  for (const rawNotification of queue) {
    const notification = rawNotification;
    const failureCount = Number(notification?.delivery?.push?.failureCount || 0);
    if (failureCount >= PUSH_RETRY_LIMIT) {
      // eslint-disable-next-line no-await-in-loop
      await Notification.updateOne(
        { _id: notification._id },
        { $set: { "delivery.push.status": "disabled", "delivery.push.lastError": "Push retry limit reached" } }
      );
      continue;
    }

    if (notification.recipientRole === "provider" && !providerWindowOpen) {
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await sendPushForNotification(notification);
    } catch (error) {
      // eslint-disable-next-line no-await-in-loop
      await Notification.updateOne(
        { _id: notification._id },
        {
          $set: {
            "delivery.push.status": "failed",
            "delivery.push.lastAttemptAt": new Date(),
            "delivery.push.lastError": error?.message || "Push send failed",
          },
          $inc: { "delivery.push.failureCount": 1 },
        }
      );
    }
  }
}
