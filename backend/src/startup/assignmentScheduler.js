import Booking from "../models/Booking.js";
import ProviderAccount from "../models/ProviderAccount.js";
import { getIO } from "./socket.js";
import { computeExpiresAt, getAcceptWindowMs, pickNextProviderForBooking } from "../lib/assignment.js";
import { notify } from "../lib/notify.js";
import Vendor from "../models/Vendor.js";

export function startAssignmentScheduler() {
  const ACCEPT_MS = getAcceptWindowMs();
  async function runOnce() {
    const now = new Date();
    const threshold = new Date(Date.now() - ACCEPT_MS);
    const q = {
      status: "pending",
      adminEscalated: false,
      assignedProvider: { $ne: "" },
      $or: [
        { expiresAt: { $ne: null, $lte: now } },
        { expiresAt: null, lastAssignedAt: { $ne: null, $lte: threshold } },
      ],
    };
    try {
      const items = await Booking.find(q).limit(50);
      for (const b of items) {
        const fromProvider = b.assignedProvider || "";
        if (fromProvider) {
          const set = new Set(b.rejectedProviders || []);
          set.add(fromProvider);
          b.rejectedProviders = Array.from(set);
        }

        const startIdx = Math.max(Number(b.assignmentIndex || 0), 0) + 1;
        // eslint-disable-next-line no-await-in-loop
        const picked = await pickNextProviderForBooking(b, startIdx);
        if (picked?.providerId) {
          const fromProviderId = fromProvider;
          const toProviderId = picked.providerId;

          // Developer Log: Re-assignment (Random/Auto)
          let toProvName = "Unknown";
          try {
            const pDoc = await ProviderAccount.findById(toProviderId).select("name").lean();
            if (pDoc) toProvName = pDoc.name;
          } catch (e) {}
          console.log(`[Scheduler] Re-assignment: Booking ${b._id} re-assigned to ${toProvName} (ID: ${toProviderId}) because ${fromProviderId} timed out.`);

          b.assignedProvider = picked.providerId;
          b.assignmentIndex = picked.index;
          b.lastAssignedAt = now;
          b.expiresAt = computeExpiresAt(now);
          b.adminEscalated = false;
          await b.save();
          try {
            const io = getIO();
            io?.of("/bookings").emit("assignment:changed", { id: b._id.toString(), fromProvider, toProvider: picked.providerId, reason: "timeout" });
            io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: "pending" });
          } catch {}
          try {
            await notify({
              recipientId: picked.providerId,
              recipientRole: "provider",
              title: "Booking Reassigned",
              message: `A booking #${b._id.toString().slice(-6)} has been reassigned to you.`,
              type: "booking_reassigned",
              meta: { bookingId: b._id.toString(), reason: "timeout" },
              respectProviderQuietHours: true,
            });
          } catch {}
        } else {
          console.log(`[Scheduler] No more candidates for Booking ${b._id}. Escalating to admin.`);
          b.assignedProvider = "";
          b.adminEscalated = true;
          b.expiresAt = null;
          await b.save();
          try {
            const io = getIO();
            io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: "pending" });
          } catch {}
          try {
            await notify({
              recipientId: "ADMIN001",
              recipientRole: "admin",
              title: "Booking Escalated",
              message: `Booking #${b._id.toString().slice(-6)} could not be auto-assigned.`,
              type: "booking_escalated",
              meta: { bookingId: b._id.toString() },
            });
            const city = b.address?.city || "";
            if (city) {
              const vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}$`, "i") }, status: "approved" }).lean();
              if (vendor) {
                await notify({
                  recipientId: vendor._id?.toString(),
                  recipientRole: "vendor",
                  title: "Booking Escalated",
                  message: `Booking #${b._id.toString().slice(-6)} in ${city} needs manual assignment.`,
                  type: "booking_escalated",
                  meta: { bookingId: b._id.toString(), city },
                });
              }
            }
          } catch {}
        }
      }
    } catch {}
  }
  setInterval(runOnce, 60 * 1000);
}
