import crypto from "crypto";
import jwt from "jsonwebtoken";
import Razorpay from "razorpay";
import SubscriptionPlan from "../../../models/SubscriptionPlan.js";
import UserSubscription from "../../../models/UserSubscription.js";
import User from "../../../models/User.js";
import ProviderAccount from "../../../models/ProviderAccount.js";
import Vendor from "../../../models/Vendor.js";
import {
  activateSubscription,
  ensureSubscriptionDefaults,
  getActiveSubscription,
  getMarketingCreditsBalance,
  getSubscriptionSettings,
  buildSubscriptionSnapshot,
} from "../../../lib/subscriptions.js";
import {
  JWT_SECRET,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET,
} from "../../../config.js";

function getRazorpay() {
  return new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
}

function ensurePaymentKeys(res) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    res.status(500).json({ error: "Razorpay keys not configured" });
    return false;
  }
  return true;
}

async function inferActor(req) {
  const headerToken =
    req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;
  const candidates = [
    headerToken,
    req.cookies?.providerToken,
    req.cookies?.vendorToken,
    req.cookies?.adminToken,
    req.cookies?.token,
  ].filter(Boolean);

  for (const token of candidates) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role === "provider") {
        const provider = await ProviderAccount.findById(payload.sub).lean();
        if (provider) return { userType: "provider", userId: provider._id.toString(), entity: provider };
      } else if (payload.role === "vendor") {
        const vendor = await Vendor.findById(payload.sub).lean();
        if (vendor) return { userType: "vendor", userId: vendor._id.toString(), entity: vendor };
      } else if (!payload.role || payload.role === "user") {
        const user = await User.findById(payload.sub).lean();
        if (user) return { userType: "customer", userId: user._id.toString(), entity: user };
      }
    } catch {}
  }
  return null;
}

function mapPlan(plan, settings) {
  const meta = {
    ...plan.meta,
    providerCommissionRate: plan.meta?.providerCommissionRate ?? plan.meta?.commissionRate ?? null,
    commissionRate: plan.meta?.commissionRate ?? plan.meta?.providerCommissionRate ?? null,
    marketingCreditsMonthly: plan.meta?.marketingCreditsMonthly ?? plan.meta?.marketingCredits ?? 0,
    marketingCredits: plan.meta?.marketingCredits ?? plan.meta?.marketingCreditsMonthly ?? 0,
    discountFundedBy: plan.meta?.discountFundedBy || settings?.defaultDiscountFundedBy || "platform",
    eliteMinRating: Number(plan.meta?.eliteMinRating || settings?.eliteMinRating || 0),
    eliteMinJobs: Number(plan.meta?.eliteMinJobs || settings?.eliteMinJobs || 0),
  };
  return {
    ...plan,
    meta,
  };
}

export async function getSubscriptionPlans(req, res) {
  try {
    await ensureSubscriptionDefaults();
    const settings = await getSubscriptionSettings();
    const userType = String(req.query.userType || "").trim().toLowerCase();
    const query = {};
    if (["customer", "provider", "vendor"].includes(userType)) query.userType = userType;
    const plans = await SubscriptionPlan.find(query).sort({ userType: 1, sortOrder: 1, price: 1 }).lean();
    res.json({ plans: plans.map((plan) => mapPlan(plan, settings)) });
  } catch (error) {
    res.status(500).json({ error: "Could not fetch subscription plans." });
  }
}

export async function getMySubscription(req, res) {
  try {
    const actor = await inferActor(req);
    if (!actor) return res.status(401).json({ error: "Unauthorized" });

    const settings = await getSubscriptionSettings();
    const active = await getActiveSubscription(actor.userId, actor.userType);
    const marketingCreditsBalance =
      actor.userType === "vendor" && active ? await getMarketingCreditsBalance(actor.userId) : 0;
    const snapshot = buildSubscriptionSnapshot({
      userType: actor.userType,
      active,
      settings,
      marketingCreditsBalance,
    });

    let subAccounts = [];
    if (actor.userType === "vendor" && snapshot.subAccountsEnabled) {
      const VendorSubAccount = (await import("../../../models/VendorSubAccount.js")).default;
      subAccounts = await VendorSubAccount.find({ vendorId: actor.userId }).sort({ createdAt: -1 }).lean();
    }

    res.json({
      subscription: snapshot,
      plan: active?.plan ? mapPlan(active.plan.toObject ? active.plan.toObject() : active.plan, settings) : null,
      record: active?.subscription || null,
      subAccounts,
    });
  } catch (error) {
    res.status(500).json({ error: "Could not fetch subscription details." });
  }
}

export async function createSubscriptionOrder(req, res) {
  if (!ensurePaymentKeys(res)) return;

  const actor = await inferActor(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });

  const { planId } = req.body;
  if (!planId) return res.status(400).json({ error: "planId is required" });

  try {
    await ensureSubscriptionDefaults();
    const settings = await getSubscriptionSettings();
    const plan = await SubscriptionPlan.findOne({ planId, userType: actor.userType, isActive: true }).lean();
    if (!plan) return res.status(404).json({ error: "Subscription plan not found." });

    const rzp = getRazorpay();
    const order = await rzp.orders.create({
      amount: Math.round(Number(plan.price || 0) * 100),
      currency: "INR",
      receipt: `sub_${actor.userType}_${actor.userId}_${Date.now()}`,
      notes: {
        purpose: "subscription",
        planId: plan.planId,
        userId: actor.userId,
        userType: actor.userType,
      },
    });

    await UserSubscription.findOneAndUpdate(
      {
        userId: actor.userId,
        userType: actor.userType,
        "paymentDetails.orderId": order.id,
      },
      {
        userId: actor.userId,
        userType: actor.userType,
        planId: plan.planId,
        planName: plan.name,
        subscriptionId: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        status: "pending_payment",
        renewalStatus: "manual",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        startDate: new Date(),
        endDate: new Date(),
        autoRenew: false,
        paymentDetails: {
          gateway: "razorpay",
          orderId: order.id,
          amountPaid: Number(plan.price || 0),
          currency: "INR",
        },
      },
      { upsert: true, new: true }
    );

    res.json({
      order,
      plan: mapPlan(plan, settings),
      subscriptionMeta: {
        userType: actor.userType,
        userId: actor.userId,
      },
    });
  } catch (error) {
    res.status(502).json({ error: "Could not create subscription order." });
  }
}

export async function verifySubscriptionPayment(req, res) {
  const actor = await inferActor(req);
  if (!actor) return res.status(401).json({ error: "Unauthorized" });
  if (!ensurePaymentKeys(res)) return;

  const { order_id, payment_id, signature, planId } = req.body;
  if (!order_id || !payment_id || !signature || !planId) {
    return res.status(400).json({ error: "Missing payment verification details." });
  }

  const expected = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(`${order_id}|${payment_id}`).digest("hex");
  if (expected !== signature) return res.status(400).json({ error: "Invalid signature" });

  try {
    const plan = await SubscriptionPlan.findOne({ planId, userType: actor.userType, isActive: true });
    if (!plan) return res.status(404).json({ error: "Subscription plan not found." });

    const { subscription, snapshot } = await activateSubscription({
      userId: actor.userId,
      userType: actor.userType,
      plan,
      orderId: order_id,
      paymentId: payment_id,
      signature,
      amountPaid: Number(plan.price || 0),
      currency: "INR",
    });

    res.json({
      success: true,
      subscription,
      snapshot,
    });
  } catch (error) {
    res.status(500).json({ error: "Could not activate subscription." });
  }
}

export async function handlePaymentWebhook(req, res) {
  if (!ensurePaymentKeys(res)) return;
  try {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      return res.status(500).json({ error: "Razorpay webhook secret not configured" });
    }

    const webhookSignature = req.headers["x-razorpay-signature"] || "";
    const expectedWebhookSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(req.rawBody || JSON.stringify(req.body || {}))
      .digest("hex");

    if (!webhookSignature || expectedWebhookSignature !== webhookSignature) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const orderId = req.body?.payload?.payment?.entity?.order_id || req.body?.order_id || req.body?.orderId;
    const paymentId = req.body?.payload?.payment?.entity?.id || req.body?.payment_id || req.body?.paymentId;
    const notes = req.body?.payload?.payment?.entity?.notes || req.body?.notes || {};
    const planId = notes?.planId || req.body?.planId;
    const userId = notes?.userId || req.body?.userId;
    const userType = notes?.userType || req.body?.userType;

    if (!orderId || !paymentId || !planId || !userId || !userType) {
      return res.status(400).json({ error: "Incomplete webhook payload." });
    }

    const plan = await SubscriptionPlan.findOne({ planId, userType, isActive: true });
    if (!plan) return res.status(404).json({ error: "Subscription plan not found." });

    await activateSubscription({
      userId,
      userType,
      plan,
      orderId,
      paymentId,
      signature: webhookSignature,
      amountPaid: Number(plan.price || 0),
      currency: "INR",
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not reconcile webhook." });
  }
}
