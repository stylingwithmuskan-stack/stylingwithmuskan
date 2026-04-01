import Booking from "../models/Booking.js";
import { OfficeSettings } from "../models/Content.js";
import { BookingSettings } from "../models/Settings.js";
import CustomEnquiry from "../models/CustomEnquiry.js";
import { slotLabelToLocalDateTime } from "../lib/slots.js";
import { getIO } from "./socket.js";
import BookingLog from "../models/BookingLog.js";
import { notify } from "../lib/notify.js";
import { processQueuedPushNotifications } from "../lib/push.js";
import { processAutoExpiredBookings } from "../lib/bookingExpiry.js";

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

export function startCron() {
  // Auto-expire escalated bookings every 5 minutes
  setInterval(async () => {
    try {
      await processAutoExpiredBookings();
    } catch (e) {
      console.error("[Cron] Error in auto-expiry:", e.message);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // Check for auto-cancellations every minute
  setInterval(async () => {
    try {
      const now = new Date();
      const officeSettings = await OfficeSettings.findOne().lean();
      const bufferMin = Math.max(Number(officeSettings?.bufferMinutes || 30), 0);
      const criticalThresholdMinutes = 60 + bufferMin; // e.g., 90 mins

      // Find bookings that are 'provider_cancelled' (waiting for vendor) but have hit the critical threshold
      const pendingReassignments = await Booking.find({
        status: "provider_cancelled"
      });

      for (const b of pendingReassignments) {
        const bookingTime = slotLabelToLocalDateTime(b.slot?.date, b.slot?.time);
        if (!bookingTime) continue;

        const diffMins = (bookingTime.getTime() - now.getTime()) / (1000 * 60);

        if (diffMins < criticalThresholdMinutes) {
          // Scenario 3: Assignment Deadline Hit -> Auto Cancel + Notify User
          b.status = "cancelled";
          b.cancelledBy = "system";
          b.cancellationReason = "Auto-cancelled: No replacement found within 90-minute window";
          await b.save();

          await BookingLog.create({
            action: "booking:auto-cancel",
            bookingId: b._id.toString(),
            meta: { reason: "reassignment_deadline_exceeded", diffMins }
          });

          try {
            const io = getIO();
            io?.of("/bookings").emit("status:update", { 
              id: b._id.toString(), 
              status: "cancelled", 
              message: "Your booking has been cancelled as we couldn't find a replacement professional in time." 
            });

            await notify({
              recipientId: b.customerId,
              recipientRole: "user",
              type: "booking_cancel",
              meta: { bookingId: b._id.toString(), reason: "reassignment_deadline_exceeded" },
            });
          } catch {}
        }
      }

      // New Logic: Reminders for Vendor and Provider
      // 1. Vendor Reminder (3 hours before booking if status is 'provider_cancelled')
      const vendorReminderThreshold = 180; // 3 hours
      const unassignedBookings = await Booking.find({
        status: "provider_cancelled",
        vendorReminderSent: { $ne: true }
      });

      for (const b of unassignedBookings) {
        const bookingTime = slotLabelToLocalDateTime(b.slot?.date, b.slot?.time);
        if (!bookingTime) continue;
        const diffMins = (bookingTime.getTime() - now.getTime()) / (1000 * 60);

        if (diffMins > 0 && diffMins <= vendorReminderThreshold) {
          b.vendorReminderSent = true;
          await b.save();
          try {
            const io = getIO();
            io?.of("/vendor").emit("notification:reminder", {
              id: b._id.toString(),
              message: `Reminder: Booking #${b._id.toString().slice(-6)} is still unassigned and starts in 3 hours. Please assign a provider.`,
              city: b.address?.city
            });

            // Note: RecipientId for vendor notification might need to be specific or handled by city
            // For now creating a system-type notification that vendors can see
            await notify({
              recipientId: "vendor_broadcast", // Or a specific vendor ID if available
              recipientRole: "vendor",
              type: "reminder",
              meta: { bookingId: b._id.toString(), city: b.address?.city, time: b.slot?.time },
            });
          } catch {}
        }
      }

      // 2. Provider Reminder (2 hours before booking if status is 'accepted' or 'vendor_reassigned')
      const providerReminderThreshold = 120; // 2 hours
      const activeBookings = await Booking.find({
        status: { $in: ["accepted", "vendor_reassigned"] },
        providerReminderSent: { $ne: true },
        assignedProvider: { $exists: true, $ne: null }
      });

      for (const b of activeBookings) {
        const bookingTime = slotLabelToLocalDateTime(b.slot?.date, b.slot?.time);
        if (!bookingTime) continue;
        const diffMins = (bookingTime.getTime() - now.getTime()) / (1000 * 60);

        if (diffMins > 0 && diffMins <= providerReminderThreshold) {
          b.providerReminderSent = true;
          await b.save();
          try {
            const io = getIO();
            io?.of("/bookings").emit("notification:reminder", {
              id: b._id.toString(),
              providerId: b.assignedProvider,
              message: `Reminder: You have a booking #${b._id.toString().slice(-6)} in 2 hours at ${b.slot?.time}.`
            });

            await notify({
              recipientId: b.assignedProvider,
              recipientRole: "provider",
              type: "reminder",
              meta: { bookingId: b._id.toString(), time: b.slot?.time },
            });
          } catch {}
        }
      }

      // Existing release logic for other statuses...
      const expired = await Booking.find({
        status: "incoming",
        expiresAt: { $ne: null, $lt: now },
      });

      // Auto-expire custom enquiry quotes
      try {
        const expirable = await CustomEnquiry.find({
          status: { $in: ["quote_submitted", "admin_approved", "waiting_for_customer_payment"] },
          "quote.expiryAt": { $lt: now },
        }).limit(50);
        if (expirable.length > 0) {
          for (const enq of expirable) {
            if (enq.status === "quote_expired") continue;
            enq.status = "quote_expired";
            enq.timeline = Array.isArray(enq.timeline) ? enq.timeline : [];
            enq.timeline.push({ action: "quote_expired", meta: { at: now.toISOString() } });
            await enq.save();
          }
        }
      } catch {}

      const office = await OfficeSettings.findOne().lean();
      const bookingSettings = await BookingSettings.findOne().lean();
      const windowOpen = withinWindow(
        now,
        bookingSettings?.providerNotificationStartTime || office?.startTime || "07:00",
        bookingSettings?.providerNotificationEndTime || office?.endTime || "22:00"
      );
      if (!windowOpen) {
        await processQueuedPushNotifications();
        return;
      }
      const queued = await Booking.find({ notificationStatus: "queued" }).limit(50);
      if (queued.length > 0) {
        for (const b of queued) {
          b.notificationStatus = "immediate";
          if (!b.assignedProvider && office?.autoAssign) {
            // leave assignment for manual or provider polling
          }
          await b.save();
          try {
            await BookingLog.create({
              action: "booking:queue-release",
              bookingId: b._id.toString(),
              meta: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "local" },
            });
          } catch {}
          try {
            const io = getIO();
            io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: b.status, notificationStatus: b.notificationStatus });
          } catch {}
        }
      }
      await processQueuedPushNotifications();
    } catch (e) {
      // swallow
    }
  }, 60 * 1000);
}
