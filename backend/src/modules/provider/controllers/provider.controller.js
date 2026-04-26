import Booking from "../../../models/Booking.js";
import ProviderAccount from "../../../models/ProviderAccount.js";
import BookingLog from "../../../models/BookingLog.js";
import Vendor from "../../../models/Vendor.js";
import { slotLabelToLocalDateTime } from "../../../lib/slots.js";
import { notify } from "../../../lib/notify.js";
import { createLedgerEntry, getProviderCommissionRate } from "../../../lib/subscriptions.js";

export async function listAssignedBookings(req, res) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const q = { assignedProvider: req.params.providerId };
  const total = await Booking.countDocuments(q);
  const bookings = await Booking.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  res.json({ bookings, page, limit, total });
}

export async function updateBookingStatus(req, res) {
  const next = (req.body.status || "").toLowerCase();
  const pId = req.auth?.sub;
  const bookingId = req.params.id;

  if (next === "accepted") {
    const acc = await ProviderAccount.findById(pId);
    if (!acc || acc.approvalStatus !== "approved") return res.status(403).json({ error: "Forbidden" });
  }

  let b = await Booking.findById(bookingId);
  if (!b) return res.status(404).json({ error: "Booking not found" });

  if (next === "rejected") {
    const acc = await ProviderAccount.findById(pId);
    if (acc) {
      const now = Date.now();
      const window = acc.rejectWindowStart || 0;
      let count = acc.rejectCount || 0;
      if (!window || now - window > 24 * 3600 * 1000) {
        count = 0;
        acc.rejectWindowStart = now;
      }
      count += 1;
      acc.rejectCount = count;
      if (count >= 3) {
        acc.blockedUntil = new Date(now + 24 * 3600 * 1000);
        acc.approvalStatus = "blocked";
        acc.rating = Math.max(0, (acc.rating || 0) - 0.5);
      }
      await acc.save();
    }

    const isPreferred = b.maintainProvider && b.maintainProvider === pId;
    const city = b.address?.city || "";

    const notifyAdminAndVendor = async (reason, cityName) => {
      try {
        const meta = { bookingId, city: cityName || "", reason };
        await notify({
          recipientId: "ADMIN001",
          recipientRole: "admin",
          type: "booking_escalated",
          meta,
        });

        if (cityName) {
          console.log(`[Notification] Searching vendor for city: ${cityName}`);
          const vendor = await Vendor.findOne({ 
            city: { $regex: new RegExp(`^${cityName}$`, "i") }, 
            status: "approved" 
          }).lean();
          
          if (vendor) {
            console.log(`[Notification] Creating vendor notification for: ${vendor._id}`);
            await notify({
              recipientId: vendor._id.toString(),
              recipientRole: "vendor",
              type: "booking_escalated",
              meta,
            });
          } else {
            console.log(`[Notification] No approved vendor found for city: ${cityName}`);
          }
        }
      } catch (err) {
        console.error("[Notification] notifyAdminAndVendor failed:", err);
      }
    };

    if (isPreferred) {
      b.status = "unassigned";
      b.assignedProvider = "";
      await b.save();

      await notify({
        recipientId: b.customerId,
        recipientRole: "user",
        type: "provider_unavailable",
        meta: { bookingId, reason: "preferred_provider_unavailable" },
      });

      await notifyAdminAndVendor("preferred_provider_rejected", city);
      await BookingLog.create({ action: "booking:status", userId: pId, bookingId, meta: { status: "rejected", subType: "preferred" } });
      return res.json({ booking: b });
    } else {
      const slotDateTime = slotLabelToLocalDateTime(b.slot?.date, b.slot?.time);
      const diffMins = slotDateTime ? (slotDateTime.getTime() - Date.now()) / (1000 * 60) : 60;

      if (diffMins < 30) {
        b.status = "expired";
        await b.save();

        await notify({
          recipientId: b.customerId,
          recipientRole: "user",
          type: "booking_expired",
          meta: { bookingId, reason: "no_provider_in_time" },
        });

        await notifyAdminAndVendor("booking_expired", city);
        await BookingLog.create({ action: "booking:status", userId: pId, bookingId, meta: { status: "rejected", subType: "expired" } });
        return res.json({ booking: b });
      } else {
        b.rejectedProviders = b.rejectedProviders || [];
        if (!b.rejectedProviders.includes(pId)) b.rejectedProviders.push(pId);

        const candidates = b.candidateProviders || [];
        const nextProviderId = candidates.find(id => !b.rejectedProviders.includes(id));

        if (nextProviderId) {
          b.assignedProvider = nextProviderId;
          b.status = "pending";
          await b.save();

          await notify({
            recipientId: nextProviderId,
            recipientRole: "provider",
            type: "new_booking",
            meta: { bookingId },
          });

          await BookingLog.create({ action: "booking:status", userId: pId, bookingId, meta: { status: "rejected", subType: "reassigned", nextProviderId } });
          return res.json({ booking: b });
        } else {
          b.status = "unassigned";
          b.assignedProvider = "";
          await b.save();

          await notifyAdminAndVendor("auto_assignment_failed", city);
          await BookingLog.create({ action: "booking:status", userId: pId, bookingId, meta: { status: "rejected", subType: "no_more_candidates" } });
          return res.json({ booking: b });
        }
      }
    }
  }

  // Prevent starting 'travelling' too early for future bookings
  if (next === "travelling") {
    const slotDateTime = slotLabelToLocalDateTime(b.slot?.date, b.slot?.time);
    if (slotDateTime) {
      const now = Date.now();
      const diffMs = slotDateTime.getTime() - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      // If more than 2 hours in the future, block it
      if (diffHours > 2) {
        return res.status(400).json({ 
          error: "Too Early", 
          message: `This booking is scheduled for ${b.slot.date} at ${b.slot.time}. You can only start travelling within 2 hours of the scheduled time.` 
        });
      }
    }
  }

  b.status = next;
  await b.save();

  // SWM Pro Partner commission logic
  if (next === "completed") {
    const commissionRate = await getProviderCommissionRate(pId);
    let commission = 0;
    const totalPaidByCustomer = Number(b.totalAmount || 0);
    const discountAmount = Number(b.discount || 0);
    const fundedBy = String(b.discountFundedBy || "admin").toLowerCase();

    // Logic: 
    // - if funded by admin: discount is deducted from the admin's commission
    // - if funded by platform/all: discount is applied to booking total, and commission is calculated on the net amount
    if (fundedBy === "admin") {
      const originalTotal = totalPaidByCustomer + discountAmount;
      const discRate = originalTotal > 0 ? (discountAmount / originalTotal) * 100 : 0;
      const effectiveRate = Math.max(0, Number(commissionRate || 0) - discRate);
      commission = Math.round(totalPaidByCustomer * (effectiveRate / 100));
    } else {
      commission = Math.round(totalPaidByCustomer * (Number(commissionRate || 0) / 100));
    }

    b.commissionAmount = Math.max(commission, 0);
    await createLedgerEntry({
      userId: String(pId),
      userType: "provider",
      subscriptionId: "",
      planId: "",
      entryType: "provider_settlement_adjustment",
      direction: "debit",
      amount: b.commissionAmount,
      meta: {
        bookingId: b._id.toString(),
        status: next,
        commissionRate,
        originalTotal: totalPaidByCustomer + discountAmount,
        discountAmount,
        fundedBy,
      },
    });
  }

  await BookingLog.create({ action: "booking:status", userId: pId, bookingId: req.params.id, meta: { status: req.body.status } });

  // Notify customer about specific milestones
  const notifyStatuses = ["accepted", "completed", "payment_pending"];
  if (b && b.customerId && notifyStatuses.includes(next)) {
    await notify({
      recipientId: b.customerId,
      recipientRole: "user",
      type: `booking_${next}`,
      meta: { bookingId: b._id.toString(), status: next },
    });
  }

  res.json({ booking: b });
}
