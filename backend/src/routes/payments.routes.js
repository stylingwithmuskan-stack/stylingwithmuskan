import { Router } from "express";
import { body, validationResult } from "express-validator";
import Razorpay from "razorpay";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ProviderAccount from "../models/ProviderAccount.js";
import ProviderWalletTxn from "../models/ProviderWalletTxn.js";
import CustomEnquiry from "../models/CustomEnquiry.js";
import Booking from "../models/Booking.js";
import BookingLog from "../models/BookingLog.js";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, JWT_SECRET } from "../config.js";

const router = Router();

function getRzp() {
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

async function requirePaymentAuth(req, res, next) {
  try {
    const headerToken =
      req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null;
    const cookies = req.cookies || {};
    
    // We'll collect all valid roles associated with any tokens provided
    let user = null;
    let provider = null;
    
    // Check tokens in order of priority: Header > cookieProvider > cookieUser
    const candidates = [headerToken, cookies.providerToken, cookies.token].filter(Boolean);
    
    for (const t of candidates) {
      try {
        const payload = jwt.verify(t, JWT_SECRET);
        
        // If it's a provider token
        if (payload.role === "provider") {
          const p = await ProviderAccount.findById(payload.sub);
          if (p && !provider) provider = p;
        } 
        // If it's a normal user token (no role field or role is user)
        else if (!payload.role || payload.role === "user") {
          const u = await User.findById(payload.sub);
          if (u && !user) user = u;
        }
      } catch {}
    }
    
    if (!user && !provider) return res.status(401).json({ error: "Unauthorized" });
    
    req.user = user;
    req.provider = provider;
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

function ensureKeys(res) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    res.status(500).json({ error: "Razorpay keys not configured" });
    return false;
  }
  return true;
}

function parsePurpose(p) {
  return String(p || "").trim().toLowerCase();
}

router.post(
  "/razorpay/order",
  requirePaymentAuth,
  body("amount").isInt({ min: 1 }),
  body("currency").optional().isString(),
  body("receipt").optional().isString(),
  body("purpose").isString(),
  body("bookingId").optional().isString(),
  body("enquiryId").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (!ensureKeys(res)) return;
    try {
      const purpose = parsePurpose(req.body.purpose);
      const bookingId = String(req.body.bookingId || "").trim();
      const enquiryId = String(req.body.enquiryId || "").trim();
      const amount = Number(req.body.amount || 0);
      if (!amount || amount < 1) return res.status(400).json({ error: "Invalid amount" });

      if (purpose === "provider_wallet_topup") {
        if (!req.provider) return res.status(403).json({ error: "Forbidden" });
      } else {
        if (!req.user) return res.status(403).json({ error: "Forbidden" });
      }

      if (purpose === "custom_advance" && !enquiryId) {
        return res.status(400).json({ error: "enquiryId required" });
      }
      if ((purpose === "booking_full" || purpose === "booking_advance") && !bookingId) {
        return res.status(400).json({ error: "bookingId required" });
      }

      let receipt = req.body.receipt || `swm_${Date.now()}`;
      if (purpose === "custom_advance" && enquiryId) receipt = `swm_enquiry_${enquiryId}`;
      if ((purpose === "booking_full" || purpose === "booking_advance") && bookingId) receipt = `swm_booking_${bookingId}`;

      console.log(`[Payment] Order request: amount=${amount} purpose=${purpose} hasKeyId=${!!RAZORPAY_KEY_ID} hasSecret=${!!RAZORPAY_KEY_SECRET}`);

      const rzp = getRzp();
      const order = await rzp.orders.create({
        amount,
        currency: req.body.currency || "INR",
        receipt,
        notes: {
          ...(req.body.notes || {}),
          purpose,
          ...(bookingId ? { bookingId } : {}),
          ...(enquiryId ? { enquiryId } : {}),
        },
      });
      res.json({ order });
    } catch (e) {
      res.status(502).json({ error: "Payment gateway unavailable" });
    }
  }
);

router.post(
  "/razorpay/verify",
  requirePaymentAuth,
  body("order_id").isString(),
  body("payment_id").isString(),
  body("signature").isString(),
  body("purpose").isString(),
  body("bookingId").optional().isString(),
  body("enquiryId").optional().isString(),
  body("amount").optional().isInt({ min: 1 }),
  async (req, res) => {
    const { order_id, payment_id, signature } = req.body;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: "Razorpay keys not configured" });
    }
    const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(order_id + "|" + payment_id)
      .digest("hex");
    if (expected !== signature) return res.status(400).json({ error: "Invalid signature" });

    const purpose = parsePurpose(req.body.purpose);
    const bookingId = String(req.body.bookingId || "").trim();
    const enquiryId = String(req.body.enquiryId || "").trim();
    const amount = Math.round(Number(req.body.amount || 0) / 100);

    if (purpose === "provider_wallet_topup") {
      if (!req.provider) return res.status(403).json({ error: "Forbidden" });
      if (!(amount > 0)) return res.status(400).json({ error: "Invalid amount" });
      req.provider.credits = Number(req.provider.credits || 0) + amount;
      await req.provider.save();
      await ProviderWalletTxn.create({
        providerId: req.provider._id.toString(),
        type: "recharge",
        amount,
        balanceAfter: req.provider.credits,
        meta: { title: "Razorpay Recharge", source: "razorpay", order_id, payment_id },
      });
      return res.json({ success: true });
    }

    if (!req.user) return res.status(403).json({ error: "Forbidden" });

    if (purpose === "user_wallet_topup") {
      if (!(amount > 0)) return res.status(400).json({ error: "Invalid amount" });
      if (!req.user.wallet) req.user.wallet = { balance: 0, transactions: [] };
      req.user.wallet.balance = (req.user.wallet.balance || 0) + amount;
      req.user.wallet.transactions.unshift({ title: "Wallet Topup", amount, type: "credit", at: new Date() });
      await req.user.save();
      return res.json({ success: true });
    }

    if ((purpose === "booking_full" || purpose === "booking_advance") && bookingId && amount > 0) {
      const b = await Booking.findOne({ _id: bookingId, customerId: req.user._id.toString() });
      if (b) {
        b.prepaidAmount = (b.prepaidAmount || 0) + amount;
        b.balanceAmount = Math.max((b.totalAmount || 0) - (b.prepaidAmount || 0), 0);
        b.paymentStatus = b.balanceAmount > 0 ? "Partially Paid" : "Fully Paid";
        b.status = b.status === "payment_pending" && b.balanceAmount === 0 ? "documentation" : b.status;
        b.paymentOrder = { id: "", amount: 0, currency: "INR", receipt: "", createdAt: null };
        await b.save();
        await BookingLog.create({ action: "booking:payment-update", userId: req.user._id.toString(), bookingId: b._id.toString(), meta: { amount } });
      }
      return res.json({ success: true });
    }

    if (purpose === "custom_advance" && enquiryId && amount > 0) {
      const enq = await CustomEnquiry.findOne({ _id: enquiryId, userId: req.user._id.toString() });
      if (enq) {
        enq.paymentStatus = "paid";
        enq.prebookPaidAt = new Date();
        enq.prebookAmountPaid = (enq.prebookAmountPaid || 0) + amount;
        enq.status = "advance_paid";
        enq.timeline = enq.timeline || [];
        enq.timeline.push({ action: "advance_paid", meta: { amount, source: "razorpay" } });
        await enq.save();
      }
      return res.json({ success: true });
    }

    return res.json({ success: true });
  }
);

export default router;
