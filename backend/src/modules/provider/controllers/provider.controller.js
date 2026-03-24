import Booking from "../../../models/Booking.js";
import ProviderAccount from "../../../models/ProviderAccount.js";
import BookingLog from "../../../models/BookingLog.js";
import UserSubscription from "../../../models/UserSubscription.js";
import SubscriptionPlan from "../../../models/SubscriptionPlan.js";

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
  if (next === "accepted") {
    const acc = await ProviderAccount.findById(pId);
    if (!acc || acc.approvalStatus !== "approved") return res.status(403).json({ error: "Forbidden" });
  }
  if (next === "rejected") {
    const acc = await ProviderAccount.findById(pId);
    const now = Date.now();
    const window = acc?.rejectWindowStart || 0;
    let count = acc?.rejectCount || 0;
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
  const b = await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });

  // SWM Pro Partner commission logic
  if (next === "completed") {
    const subscription = await UserSubscription.findOne({ userId: pId, status: 'active' });
    if (subscription) {
      const plan = await SubscriptionPlan.findOne({ planId: subscription.planId });
      if (plan && plan.meta.commissionRate !== null) {
        const commission = b.totalAmount * (plan.meta.commissionRate / 100);
        // Here you would deduct the commission from the provider's earnings
        console.log(`Deducting ${commission} commission for SWM Pro Partner.`);
      }
    }
  }

  await BookingLog.create({ action: "booking:status", userId: pId, bookingId: req.params.id, meta: { status: req.body.status } });
  res.json({ booking: b });
}
