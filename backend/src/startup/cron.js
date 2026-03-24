import Booking from "../models/Booking.js";
import { OfficeSettings } from "../models/Content.js";
import { BookingSettings } from "../models/Settings.js";
import CustomEnquiry from "../models/CustomEnquiry.js";
import { getIO } from "./socket.js";
import BookingLog from "../models/BookingLog.js";

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

export async function startCron() {
  setInterval(async () => {
    try {
      const now = new Date();

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
      if (!windowOpen) return;
      const queued = await Booking.find({ notificationStatus: "queued" }).limit(50);
      if (queued.length === 0) return;
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
    } catch (e) {
      // swallow
    }
  }, 60 * 1000);
}
