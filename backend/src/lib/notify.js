import Notification from "../models/Notification.js";
import { getIO } from "../startup/socket.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";

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
  const amountText = formatAmount(safeMeta.amount);
  const statusText = titleCase(safeMeta.status);
  const cityText = safeMeta.city ? ` in ${safeMeta.city}` : "";
  const reasonText = safeMeta.reason || safeMeta.cancellationReason || safeMeta.cancelledBy;
  const reasonHuman = reasonText ? humanize(reasonText) : "";

  switch (canonical) {
    case "booking_created":
      return {
        title: "Booking Created",
        message: `${ref} created successfully. We'll assign a professional shortly.`,
      };
    case "booking_assigned":
      if (recipientRole === "provider") {
        return {
          title: "New Booking Assigned",
          message: `You have a new ${ref}. Please accept or reject.`,
        };
      }
      if (recipientRole === "user") {
        return {
          title: "Provider Assigned",
          message: `A professional has been assigned for your ${ref}.`,
        };
      }
      return {
        title: "Booking Assigned",
        message: `${ref} has been assigned to a provider.`,
      };
    case "booking_reassigned":
      if (recipientRole === "provider") {
        return {
          title: "Booking Reassigned",
          message: `A ${ref} has been reassigned to you.`,
        };
      }
      if (recipientRole === "user") {
        return {
          title: "Provider Reassigned",
          message: `Your ${ref} has been reassigned to a new professional.`,
        };
      }
      return {
        title: "Booking Reassigned",
        message: `${ref} has been reassigned to a different provider.`,
      };
    case "booking_status":
      if (recipientRole === "user") {
        return {
          title: statusText ? `Booking ${statusText}` : "Booking Update",
          message: statusText ? `Your ${ref} status is ${statusText}.` : `Your ${ref} status was updated.`,
        };
      }
      return {
        title: statusText ? `Booking ${statusText}` : "Booking Update",
        message: statusText ? `${ref} status updated to ${statusText}.` : `${ref} status was updated.`,
      };
    case "booking_cancelled":
      return {
        title: "Booking Cancelled",
        message: reasonHuman ? `${ref} was cancelled (${reasonHuman}).` : `${ref} was cancelled.`,
      };
    case "booking_escalated":
      return {
        title: "Booking Escalated",
        message: `${ref}${cityText} needs attention${reasonHuman ? `: ${reasonHuman}` : "."}`,
      };
    case "payment_required":
      return {
        title: "Payment Required",
        message: amountText ? `Please complete payment of ${amountText} for ${ref}.` : `Please complete the pending payment for ${ref}.`,
      };
    case "payment_success":
      return {
        title: "Payment Successful",
        message: amountText ? `Payment of ${amountText} received for ${ref}.` : `Payment received for ${ref}.`,
      };
    case "payment_refund":
      return {
        title: "Refund Initiated",
        message: amountText ? `Refund of ${amountText} initiated for ${ref}.` : `Refund initiated for ${ref}.`,
      };
    case "wallet_topup":
      return {
        title: "Wallet Top-up Successful",
        message: amountText ? `${amountText} added to your wallet.` : "Wallet top-up successful.",
      };
    case "commission_hold":
      return {
        title: "Commission Held",
        message: amountText ? `Commission of ${amountText} held for ${ref}.` : `Commission held for ${ref}.`,
      };
    case "commission_refund":
      return {
        title: "Commission Refunded",
        message: amountText ? `Commission refund of ${amountText} processed for ${ref}.` : `Commission refund processed for ${ref}.`,
      };
    case "provider_vendor_approved":
      return {
        title: "Vendor Approval",
        message: "Your profile has been approved by the vendor.",
      };
    case "provider_admin_approved":
      return {
        title: "Admin Approval",
        message: "Your profile has been approved by the admin.",
      };
    case "provider_rejected":
      return {
        title: "Profile Rejected",
        message: reasonHuman ? `Your profile was rejected: ${reasonHuman}.` : "Your profile was rejected.",
      };
    case "vendor_approved":
      return {
        title: "Vendor Approved",
        message: "Your vendor account has been approved.",
      };
    case "vendor_rejected":
      return {
        title: "Vendor Rejected",
        message: reasonHuman ? `Your vendor account was rejected: ${reasonHuman}.` : "Your vendor account was rejected.",
      };
    case "custom_quote_submitted":
      return {
        title: "Custom Quote Submitted",
        message: amountText ? `Quote for ${ref} is ${amountText}. Please review and approve.` : `Quote submitted for ${ref}.`,
      };
    case "custom_approved":
      return {
        title: "Custom Enquiry Approved",
        message: `Your ${ref} has been approved.`,
      };
    case "custom_advance_paid":
      return {
        title: "Advance Paid",
        message: `Advance payment received for ${ref}.`,
      };
    case "sos_alert":
      return {
        title: "SOS Alert",
        message: `SOS raised for ${ref}${cityText}. Immediate attention required.`,
      };
    case "leave_requested":
      return {
        title: "Leave Requested",
        message: "A new leave request has been submitted.",
      };
    case "leave_approved":
      return {
        title: "Leave Approved",
        message: "Your leave request has been approved.",
      };
    case "leave_rejected":
      return {
        title: "Leave Rejected",
        message: reasonHuman ? `Your leave request was rejected: ${reasonHuman}.` : "Your leave request was rejected.",
      };
    case "reminder":
      return {
        title: "Booking Reminder",
        message: `Reminder: ${ref} is coming up soon${safeMeta.time ? ` at ${safeMeta.time}` : ""}.`,
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
  meta = {},
  emit = true,
  respectProviderQuietHours = true,
}) {
  if (!recipientId || !recipientRole) return null;
  const safeMeta = { ...(meta || {}) };
  const templated = formatNotification({ recipientRole, type, meta: safeMeta });
  const payload = {
    recipientId: String(recipientId),
    recipientRole,
    title: templated?.title || title || "Notification",
    message: templated?.message || message || "You have a new notification.",
    type,
    meta: safeMeta,
  };
  const notification = await Notification.create(payload);

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
