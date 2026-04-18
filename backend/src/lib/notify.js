import Notification from "../models/Notification.js";
import { getIO } from "../startup/socket.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";
import { buildNotificationLink, queuePushForNotification, sendPushForNotification, isDuplicatePush } from "./push.js";

const TYPE_ALIASES = {
  new_booking: "booking_assigned",
  booking_cancel: "booking_cancelled",
  booking_expired: "booking_cancelled",
  provider_unavailable: "booking_cancelled",
  booking_alert: "booking_escalated",
  reassignment: "booking_reassigned",
  reminder: "reminder",
};

const CANONICAL_TYPES = new Set([
  "booking_created",
  "booking_assigned",
  "booking_reassigned",
  "booking_status",
  "booking_cancelled",
  "booking_escalated",
  "payment_required",
  "payment_success",
  "payment_refund",
  "booking_cancelled_refund",
  "refund_processed",
  "refund_failed",
  "wallet_topup",
  "commission_hold",
  "commission_refund",
  "provider_vendor_approved",
  "provider_admin_approved",
  "provider_rejected",
  "vendor_approved",
  "vendor_rejected",
  "custom_quote_submitted",
  "custom_approved",
  "custom_advance_paid",
  "sos_alert",
  "leave_requested",
  "leave_approved",
  "leave_rejected",
  "reminder",
  "marketing_campaign",
  "zone_added",
]);

function shortId(id) {
  const s = String(id || "").trim();
  if (!s) return "";
  return s.slice(-6);
}

function humanize(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function titleCase(value) {
  const v = humanize(value);
  if (!v) return "";
  return v.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAmount(amount) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return "";
  try {
    return `₹${amt.toLocaleString("en-IN")}`;
  } catch {
    return `₹${Math.round(amt)}`;
  }
}

function pickServiceName(list) {
  if (!Array.isArray(list) || list.length === 0) return "";
  const first = list.find(Boolean);
  if (!first) return "";
  if (typeof first === "string") return first;
  return (
    first.name ||
    first.serviceName ||
    first.title ||
    first.service ||
    ""
  );
}

function normalizeServiceName(meta = {}) {
  return (
    meta.serviceName ||
    meta.service ||
    meta.serviceType ||
    pickServiceName(meta.items) ||
    pickServiceName(meta.services) ||
    pickServiceName(meta.selectedServices) ||
    ""
  );
}

async function enrichMeta(meta = {}) {
  const safe = { ...(meta || {}) };
  if (!safe.serviceName && safe.bookingId) {
    try {
      const Booking = (await import("../models/Booking.js")).default;
      const booking = await Booking.findById(safe.bookingId).lean();
      if (booking) {
        safe.serviceName =
          pickServiceName(booking.items) ||
          pickServiceName(booking.services) ||
          safe.serviceName ||
          "";
        if (!safe.city && booking.address?.city) safe.city = booking.address.city;
        if (!safe.time && booking.slot?.time) safe.time = booking.slot.time;
        if (!safe.date && booking.slot?.date) safe.date = booking.slot.date;
      }
    } catch {}
  }
  if (!safe.serviceName && safe.enquiryId) {
    try {
      const CustomEnquiry = (await import("../models/CustomEnquiry.js")).default;
      const enquiry = await CustomEnquiry.findById(safe.enquiryId).lean();
      if (enquiry) {
        safe.serviceName =
          pickServiceName(enquiry.selectedServices) ||
          pickServiceName(enquiry.services) ||
          enquiry.eventType ||
          safe.serviceName ||
          "";
        if (!safe.city && enquiry.address?.city) safe.city = enquiry.address.city;
      }
    } catch {}
  }
  return safe;
}

function buildRef(meta = {}) {
  if (meta?.bookingId) return { label: "Booking", id: `#${shortId(meta.bookingId)}` };
  if (meta?.enquiryId) return { label: "Enquiry", id: `#${shortId(meta.enquiryId)}` };
  return { label: "Request", id: "" };
}

function normalizeType(type, meta = {}) {
  const raw = String(type || "").trim();
  const alias = TYPE_ALIASES[raw];
  if (alias) return alias;
  if (raw.startsWith("booking_") && raw !== "booking_created" && raw !== "booking_assigned" && raw !== "booking_reassigned" && raw !== "booking_status" && raw !== "booking_cancelled") {
    if (!meta.status) {
      meta.status = raw.slice("booking_".length);
    }
    return "booking_status";
  }
  return raw;
}

function formatNotification({ recipientRole, type, meta = {} }) {
  const safeMeta = { ...(meta || {}) };
  const canonical = normalizeType(type, safeMeta);
  if (!CANONICAL_TYPES.has(canonical)) return null;

  const { label, id } = buildRef(safeMeta);
  const ref = id ? `${label} ${id}` : label;
  const serviceName = normalizeServiceName(safeMeta);
  const servicePlain = serviceName || "service";
  const yourBooking = serviceName ? `your ${serviceName} booking` : "your booking";
  const aBooking = serviceName ? `a ${serviceName} booking` : "a booking";
  const amountText = formatAmount(safeMeta.amount);
  const statusText = titleCase(safeMeta.status);
  const cityText = safeMeta.city ? ` in ${safeMeta.city}` : "";
  const reasonText = safeMeta.reason || safeMeta.cancellationReason || safeMeta.cancelledBy;
  const reasonHuman = reasonText ? humanize(reasonText) : "";

  switch (canonical) {
    case "booking_created":
      return {
        title: "Booking Confirmed",
        message: `Your booking${serviceName ? ` for ${serviceName}` : ""} has been created successfully. We'll assign the best professional shortly.`,
      };
    case "booking_assigned":
      if (recipientRole === "provider") {
        return {
          title: "New Booking Assigned",
          message: `You've received ${aBooking}. Please accept or reject.`,
          sound: "ringtone",
        };
      }
      if (recipientRole === "user") {
        return {
          title: "Professional Assigned",
          message: `A professional has been assigned for ${yourBooking}.`,
          sound: "notification",
        };
      }
      return {
        title: "Booking Assigned",
        message: `${aBooking} has been assigned to a provider.`,
        sound: "notification",
      };
    case "booking_reassigned":
      if (recipientRole === "provider") {
        return {
          title: "Booking Reassigned",
          message: `${aBooking} has been reassigned to you.`,
          sound: "ringtone",
        };
      }
      if (recipientRole === "user") {
        return {
          title: "Provider Reassigned",
          message: `Your ${serviceName ? `${serviceName} booking` : "booking"} has been reassigned to another professional for faster service.`,
          sound: "notification",
        };
      }
      return {
        title: "Booking Reassigned",
        message: `${aBooking} has been reassigned to a different provider.`,
        sound: "notification",
      };
    case "booking_status":
      const sound = safeMeta.status === "reached" ? "doorbell" : "notification";
      if (recipientRole === "user") {
        return {
          title: statusText ? `Booking ${statusText}` : "Booking Update",
          message: statusText ? `Your ${serviceName ? `${serviceName} booking` : "booking"} is now ${statusText}.` : `Your booking status was updated.`,
          sound,
        };
      }
      return {
        title: statusText ? `Booking ${statusText}` : "Booking Update",
        message: statusText ? `${aBooking} status updated to ${statusText}.` : `Booking status was updated.`,
        sound,
      };
    case "booking_cancelled":
      return {
        title: "Booking Cancelled",
        message: reasonHuman ? `${yourBooking} was cancelled (${reasonHuman}).` : `${yourBooking} was cancelled.`,
        sound: "alert",
      };
    case "booking_escalated":
      return {
        title: "Booking Escalated",
        message: `${aBooking}${cityText} needs attention${reasonHuman ? `: ${reasonHuman}` : "."}`,
        sound: "emergency",
      };
    case "payment_required":
      return {
        title: "Payment Required",
        message: amountText ? `Please complete payment of ${amountText} for ${yourBooking}.` : `Please complete the payment for ${yourBooking} to continue.`,
        sound: "notification",
      };
    case "payment_success":
      return {
        title: "Payment Successful",
        message: amountText ? `Your payment of ${amountText} for ${servicePlain} was successful. Thank you!` : `Your payment for ${servicePlain} was successful. Thank you!`,
        sound: "success",
      };
    case "payment_refund":
      return {
        title: "Refund Initiated",
        message: amountText ? `Refund of ${amountText} initiated for ${servicePlain}.` : `Refund initiated for ${servicePlain}.`,
        sound: "notification",
      };
    case "booking_cancelled_refund":
      return {
        title: "Refund Update",
        message: amountText
          ? `Your ${servicePlain} booking was cancelled. A refund of ${amountText} is being processed.`
          : `Your ${servicePlain} booking was cancelled. Your refund is being processed.`,
        sound: "notification",
      };
    case "refund_processed":
      return {
        title: "Refund Processed",
        message: amountText
          ? `Your refund of ${amountText} for ${servicePlain} has been processed and will reflect soon.`
          : `Your refund for ${servicePlain} has been processed and will reflect soon.`,
        sound: "success",
      };
    case "refund_failed":
      return {
        title: "Refund Failed",
        message: `We couldn't process your refund for ${servicePlain}. Please contact support.`,
        sound: "alert",
      };
    case "wallet_topup":
      return {
        title: "Wallet Top-up Successful",
        message: amountText ? `${amountText} added to your wallet.` : "Wallet top-up successful.",
        sound: "success",
      };
    case "commission_hold":
      return {
        title: "Commission Held",
        message: amountText ? `Commission hold of ${amountText} applied for ${servicePlain}.` : `Commission hold applied for ${servicePlain}.`,
        sound: "notification",
      };
    case "commission_refund":
      return {
        title: "Commission Refunded",
        message: amountText ? `Commission refund of ${amountText} processed for ${servicePlain}.` : `Commission refund processed for ${servicePlain}.`,
        sound: "success",
      };
    case "provider_vendor_approved":
      return {
        title: "Vendor Approval",
        message: "Your profile has been approved by the vendor.",
        sound: "success",
      };
    case "provider_admin_approved":
      return {
        title: "Admin Approval",
        message: "Your profile has been approved by the admin.",
        sound: "success",
      };
    case "provider_rejected":
      return {
        title: "Profile Rejected",
        message: reasonHuman ? `Your profile was rejected: ${reasonHuman}.` : "Your profile was rejected.",
        sound: "alert",
      };
    case "vendor_approved":
      return {
        title: "Vendor Approved",
        message: "Your vendor account has been approved.",
        sound: "success",
      };
    case "vendor_rejected":
      return {
        title: "Vendor Rejected",
        message: reasonHuman ? `Your vendor account was rejected: ${reasonHuman}.` : "Your vendor account was rejected.",
        sound: "alert",
      };
    case "custom_quote_submitted":
      if (recipientRole === "user") {
        return {
          title: "Quote Ready",
          message: `Your custom quote for ${servicePlain} is ready. Please review and confirm.`,
          sound: "notification",
        };
      }
      return {
        title: "New Custom Enquiry",
        message: `A new custom enquiry for ${servicePlain} is waiting for quote.`,
        sound: "alert",
      };
    case "custom_approved":
      return {
        title: "Booking Approved",
        message: `Your custom booking for ${servicePlain} has been approved and is now active.`,
        sound: "success",
      };
    case "custom_advance_paid":
      return {
        title: "Advance Payment Received",
        message: `Advance payment received for ${servicePlain}.`,
        sound: "success",
      };
    case "sos_alert":
      return {
        title: "SOS Alert",
        message: `SOS received for ${servicePlain} booking${cityText}. Immediate attention required.`,
        sound: "emergency",
      };
    case "leave_requested":
      return {
        title: "Leave Requested",
        message: "A new leave request has been submitted.",
        sound: "notification",
      };
    case "leave_approved":
      return {
        title: "Leave Approved",
        message: "Your leave request has been approved.",
        sound: "success",
      };
    case "leave_rejected":
      return {
        title: "Leave Rejected",
        message: reasonHuman ? `Your leave request was rejected: ${reasonHuman}.` : "Your leave request was rejected.",
        sound: "alert",
      };
    case "zone_added":
      return {
        title: "New Zone Added!",
        message: `A new zone "${safeMeta.zoneName || "New Area"}" has been added in your city. Check it out and request access!`,
        sound: "notification",
      };
    case "reminder":
      return {
        title: "Booking Reminder",
        message: `Reminder: ${yourBooking} is coming up soon${safeMeta.time ? ` at ${safeMeta.time}` : ""}.`,
        sound: "notification",
      };
    case "marketing_campaign":
      return {
        title: safeMeta.title || titleCase(type) || "Special Update",
        message: safeMeta.message || "You have a new update from Styling With Muskan.",
        sound: "notification",
      };

    default:
      return null;
  }
}

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

async function isWithinProviderWindow() {
  try {
    const office = await OfficeSettings.findOne().lean();
    const bookingSettings = await BookingSettings.findOne().lean();
    const now = new Date();
    return withinWindow(
      now,
      bookingSettings?.providerNotificationStartTime || office?.startTime || "07:00",
      bookingSettings?.providerNotificationEndTime || office?.endTime || "22:00"
    );
  } catch {
    return true;
  }
}

export async function notify({
  recipientId,
  recipientRole,
  type,
  title,
  message,
  link,
  meta = {},
  emit = true,
  respectProviderQuietHours = true,
  dedupeKey = "",
  dedupeWindowMs = 0,
}) {
  if (!recipientId || !recipientRole) return null;

  // Deduplication guard for cron-triggered notifications
  if (dedupeKey && dedupeWindowMs > 0) {
    try {
      const isDup = await isDuplicatePush(String(recipientId), dedupeKey, dedupeWindowMs);
      if (isDup) return null;
    } catch (err) {
      console.error("[Notify] Dedup check failed (fail-open):", err.message);
    }
  }

  const safeMeta = await enrichMeta(meta || {});
  const templated = formatNotification({ recipientRole, type, meta: safeMeta });
  const payload = {
    recipientId: String(recipientId),
    recipientRole,
    title: templated?.title || title || "Notification",
    message: templated?.message || message || "You have a new notification.",
    type,
    link: link || buildNotificationLink({ recipientRole, type, meta: safeMeta }),
    meta: dedupeKey ? { ...safeMeta, dedupeKey } : safeMeta,
    sound: meta?.sound || templated?.sound || null,
  };
  const notification = await Notification.create({
    ...payload,
    sound: payload.sound,
  });

  let shouldEmit = emit;
  if (recipientRole === "provider" && respectProviderQuietHours) {
    const ok = await isWithinProviderWindow();
    if (!ok) shouldEmit = false;
  }
  if (shouldEmit) {
    try {
      const io = getIO();
      io?.of("/bookings").emit("new_notification", {
        recipientId: String(recipientId),
        notification,
      });
    } catch {}
  }

  // Send FCM push notification
  try {
    if (recipientRole === "provider" && respectProviderQuietHours) {
      const ok = await isWithinProviderWindow();
      if (!ok) {
        await queuePushForNotification(notification, "Provider quiet hours");
      } else {
        await sendPushForNotification(notification);
      }
    } else {
      await sendPushForNotification(notification);
    }
  } catch (error) {
    console.error("[Notify] Push notification error:", error.message);
  }
  return notification;
}

export async function notifyMany(recipients = [], base = {}) {
  const items = Array.isArray(recipients) ? recipients : [];
  const results = [];
  for (const r of items) {
    if (!r) continue;
    // eslint-disable-next-line no-await-in-loop
    const n = await notify({ ...base, recipientId: r });
    if (n) results.push(n);
  }
  return results;
}
