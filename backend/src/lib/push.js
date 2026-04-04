import Notification from "../models/Notification.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";
import {
  PUSH_DEFAULT_CLICK_BASE_URL,
} from "../config.js";

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

// Firebase push notification functions removed
// Notifications are now delivered only via Socket.io
export async function sendPushForNotification(notification) {
  // Mark as delivered via Socket.io only
  await Notification.updateOne(
    { _id: notification._id },
    {
      $set: {
        "delivery.push.status": "socket_only",
        "delivery.push.lastError": "Push notifications disabled - using Socket.io only",
      },
    }
  );
  return { sent: 0, failed: 0 };
}

export async function queuePushForNotification(notification, reason = "Socket.io delivery only") {
  await Notification.updateOne(
    { _id: notification._id },
    {
      $set: {
        "delivery.push.status": "socket_only",
        "delivery.push.lastError": reason,
      },
    }
  );
}

export async function processQueuedPushNotifications() {
  // No-op: Firebase push removed, Socket.io handles all notifications
  return;
}
