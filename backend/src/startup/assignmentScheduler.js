import Booking from "../models/Booking.js";
import ProviderAccount from "../models/ProviderAccount.js";
import { getIO } from "./socket.js";
import { computeExpiresAt, getAcceptWindowMs, pickNextProviderForBooking } from "../lib/assignment.js";
import { notify } from "../lib/notify.js";
import Vendor from "../models/Vendor.js";
import { slotLabelToLocalDateTime, parseDurationToMinutes } from "../lib/slots.js";
import { buildAssignmentCandidates } from "../lib/assignmentCandidates.js";
import { invalidateProviderSlots } from "../lib/availability.js";

export function startAssignmentScheduler() {
  const ACCEPT_MS = getAcceptWindowMs();
  async function runOnce() {
    const now = new Date();
    const threshold = new Date(Date.now() - ACCEPT_MS);
    // 1) Handle pending bookings with no assigned provider (re-discovery + timed escalation)
    try {
      const unassigned = await Booking.find({
        status: "pending",
        adminEscalated: false,
        vendorEscalated: false,
        $or: [{ assignedProvider: "" }, { assignedProvider: null }],
      }).limit(50);

      for (const b of unassigned) {
        const slotStart = slotLabelToLocalDateTime(b.slot?.date, b.slot?.time);
        const diffMs = slotStart ? slotStart.getTime() - now.getTime() : null;

        // Re-discovery: rebuild candidates and assign if possible
        const requestedDurationMinutes = (b.services || []).reduce((sum, it) => {
          const per = parseDurationToMinutes(it?.duration, 60);
          const qty = Number(it?.quantity || 1);
          return sum + (per * (Number.isFinite(qty) ? qty : 1));
        }, 0);

        const { candidateProviders } = await buildAssignmentCandidates({
          address: b.address,
          slot: b.slot,
          items: b.services || [],
          customerId: b.customerId,
          requestedDurationMinutes,
          useCache: false,
        });

        if (candidateProviders.length > 0) {
          // eslint-disable-next-line no-await-in-loop
          const picked = await pickNextProviderForBooking(
            { candidateProviders, rejectedProviders: b.rejectedProviders || [], slot: b.slot, _id: b._id },
            0
          );
          if (picked?.providerId) {
            b.candidateProviders = candidateProviders;
            b.assignedProvider = picked.providerId;
            b.assignmentIndex = picked.index;
            b.lastAssignedAt = now;
            b.expiresAt = computeExpiresAt(now);
            await b.save();
            try {
              if (b?.slot?.date) await invalidateProviderSlots(picked.providerId, b.slot.date);
            } catch {}

            try {
              const io = getIO();
              io?.of("/bookings").emit("assignment:changed", {
                id: b._id.toString(),
                fromProvider: "",
                toProvider: picked.providerId,
                reason: "auto_assign",
              });
              io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: "pending" });
            } catch {}

            try {
              await notify({
                recipientId: picked.providerId,
                recipientRole: "provider",
                type: "booking_assigned",
                meta: { bookingId: b._id.toString() },
                respectProviderQuietHours: true,
              });
              await notify({
                recipientId: b.customerId,
                recipientRole: "user",
                type: "booking_assigned",
                meta: { bookingId: b._id.toString() },
              });
            } catch {}
            continue;
          }
        }

        // Timed escalation: only within 2 hours of slot time
        if (diffMs !== null && diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000) {
          const city = b.address?.city || "";
          let vendor = null;
          if (city) {
            vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}`, "i") }, status: "approved" }).lean();
          }

          if (vendor) {
            console.log(`[Scheduler] Unassigned Booking ${b._id} escalated to vendor in ${city}.`);
            b.vendorEscalated = true;
            b.vendorEscalatedAt = now;
            b.adminEscalated = false;
            await b.save();

            try {
              await notify({
                recipientId: vendor._id?.toString(),
                recipientRole: "vendor",
                type: "booking_escalated",
                meta: { bookingId: b._id.toString(), city, reason: "manual assignment needed" },
              });
              await notify({
                recipientId: "ADMIN001",
                recipientRole: "admin",
                type: "booking_escalated",
                meta: { bookingId: b._id.toString(), city, vendorId: vendor._id?.toString(), reason: "escalated to vendor" },
              });
            } catch {}
          } else {
            console.log(`[Scheduler] Unassigned Booking ${b._id} has no vendor for ${city}. Escalating to admin.`);
            b.adminEscalated = true;
            b.vendorEscalated = false;
            await b.save();

            try {
              await notify({
                recipientId: "ADMIN001",
                recipientRole: "admin",
                type: "booking_escalated",
                meta: { bookingId: b._id.toString(), city, reason: "no vendor found" },
              });
            } catch {}
          }

          try {
            const io = getIO();
            io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: "pending" });
          } catch {}
        }
      }
    } catch {}

    const q = {
      status: "pending",
      adminEscalated: false,
      vendorEscalated: false,
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
          b.vendorEscalated = false;
          await b.save();
          try {
            if (b?.slot?.date) {
              const ids = Array.from(new Set([fromProvider, picked.providerId].filter(Boolean)));
              for (const id of ids) {
                // eslint-disable-next-line no-await-in-loop
                await invalidateProviderSlots(id, b.slot.date);
              }
            }
          } catch {}
          try {
            const io = getIO();
            io?.of("/bookings").emit("assignment:changed", { id: b._id.toString(), fromProvider, toProvider: picked.providerId, reason: "timeout" });
            io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: "pending" });
          } catch {}
          try {
            await notify({
              recipientId: picked.providerId,
              recipientRole: "provider",
              type: "booking_reassigned",
              meta: { bookingId: b._id.toString(), reason: "timeout" },
              respectProviderQuietHours: true,
            });
          } catch {}
        } else {
          const slotStart = slotLabelToLocalDateTime(b.slot?.date, b.slot?.time);
          const diffMs = slotStart ? slotStart.getTime() - now.getTime() : null;

          if (diffMs !== null && diffMs > 0 && diffMs <= 2 * 60 * 60 * 1000) {
            // No more candidates and within 2 hours -> escalate to vendor
            const city = b.address?.city || "";
            let vendor = null;

            if (city) {
              vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}`, "i") }, status: "approved" }).lean();
            }

            if (vendor) {
              console.log(`[Scheduler] No more candidates for Booking ${b._id}. Escalating to vendor in ${city}.`);
              b.assignedProvider = "";
              b.vendorEscalated = true;
              b.vendorEscalatedAt = now;
              b.adminEscalated = false;
              b.expiresAt = null;
              await b.save();
              try {
                if (b?.slot?.date && fromProvider) await invalidateProviderSlots(fromProvider, b.slot.date);
              } catch {}

              try {
                await notify({
                  recipientId: vendor._id?.toString(),
                  recipientRole: "vendor",
                  type: "booking_escalated",
                  meta: { bookingId: b._id.toString(), city, reason: "manual assignment needed" },
                });

                // Also notify admin (as copy)
                await notify({
                  recipientId: "ADMIN001",
                  recipientRole: "admin",
                  type: "booking_escalated",
                  meta: { bookingId: b._id.toString(), city, vendorId: vendor._id?.toString(), reason: "escalated to vendor" },
                });
              } catch {}
            } else {
              // Fallback to admin if no vendor found
              console.log(`[Scheduler] No more candidates for Booking ${b._id}. No vendor found for ${city}. Escalating to admin.`);
              b.assignedProvider = "";
              b.adminEscalated = true;
              b.vendorEscalated = false;
              b.expiresAt = null;
              await b.save();
              try {
                if (b?.slot?.date && fromProvider) await invalidateProviderSlots(fromProvider, b.slot.date);
              } catch {}

              try {
                await notify({
                  recipientId: "ADMIN001",
                  recipientRole: "admin",
                  type: "booking_escalated",
                  meta: { bookingId: b._id.toString(), city, reason: "no vendor found" },
                });
              } catch {}
            }

            try {
              const io = getIO();
              io?.of("/bookings").emit("status:update", { id: b._id.toString(), status: "pending" });
            } catch {}
          } else {
            // Outside 2 hour window -> release back to unassigned pool
            b.assignedProvider = "";
            b.expiresAt = null;
            b.lastAssignedAt = null;
            b.assignmentIndex = -1;
            await b.save();
            try {
              if (b?.slot?.date && fromProvider) await invalidateProviderSlots(fromProvider, b.slot.date);
            } catch {}
          }
        }
      }
    } catch {}
  }
  setInterval(runOnce, 60 * 1000);
}
