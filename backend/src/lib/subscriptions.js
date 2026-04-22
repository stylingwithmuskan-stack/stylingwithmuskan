import SubscriptionPlan from "../models/SubscriptionPlan.js";
import UserSubscription from "../models/UserSubscription.js";
import SubscriptionLedger from "../models/SubscriptionLedger.js";
import { SubscriptionSettings, CommissionSettings } from "../models/Settings.js";

const DEFAULT_PLANS = [
  {
    planId: "swm_plus_quarterly",
    name: "SWM Plus Quarterly",
    userType: "customer",
    price: 299,
    durationDays: 90,
    billingCycle: "quarterly",
    tagline: "Quarterly savings for frequent salon bookings",
    sortOrder: 1,
    benefits: [
      "10% discount on bookings above INR 499",
      "Zero convenience and travel fees",
      "Priority booking access",
      "Free cancellation window",
      "Premium and elite stylist access",
    ],
    meta: {
      discountPercentage: 10,
      minCartValueForDiscount: 499,
      discountFundedBy: "platform",
      freeCancellationWindowHours: 1,
      zeroConvenienceFee: true,
      zeroTravelFee: true,
      priorityBookingEnabled: true,
      eliteAccessEnabled: true,
      eliteMinRating: 4.7,
      eliteMinJobs: 25,
    },
  },
  {
    planId: "swm_plus_annual",
    name: "SWM Plus Annual",
    userType: "customer",
    price: 899,
    durationDays: 365,
    billingCycle: "annual",
    tagline: "Best value for loyal SWM customers",
    sortOrder: 2,
    benefits: [
      "15% discount on bookings above INR 499",
      "Zero convenience and travel fees",
      "Priority booking access",
      "Free cancellation window",
      "Premium and elite stylist access",
    ],
    meta: {
      discountPercentage: 15,
      minCartValueForDiscount: 499,
      discountFundedBy: "platform",
      freeCancellationWindowHours: 2,
      zeroConvenienceFee: true,
      zeroTravelFee: true,
      priorityBookingEnabled: true,
      eliteAccessEnabled: true,
      eliteMinRating: 4.7,
      eliteMinJobs: 25,
    },
  },
  {
    planId: "swm_pro_monthly",
    name: "SWM Pro Partner",
    userType: "provider",
    price: 999,
    durationDays: 30,
    billingCycle: "monthly",
    tagline: "Lower commission and faster lead access",
    sortOrder: 1,
    benefits: [
      "5% commission on completed jobs",
      "Exclusive early lead window",
      "Pro badge",
      "Boosted visibility",
      "Premium training access",
    ],
    meta: {
      providerCommissionRate: 5,
      commissionRate: 5,
      leadPriorityWindowMinutes: 5,
      proBadgeEnabled: true,
      boostedVisibilityEnabled: true,
      premiumTrainingAccess: true,
    },
  },
  {
    planId: "swm_vendor_enterprise_monthly",
    name: "SWM City Manager Enterprise",
    userType: "vendor",
    price: 4999,
    durationDays: 30,
    billingCycle: "monthly",
    tagline: "Enterprise operations control for your city",
    sortOrder: 1,
    benefits: [
      "Advanced analytics",
      "Sub-account access",
      "Priority support",
      "Monthly marketing credits",
      "Performance commission reporting",
    ],
    meta: {
      marketingCreditsMonthly: 1000,
      marketingCredits: 1000,
      prioritySupport: true,
      subAccountsEnabled: true,
      vendorPerformanceCommissionType: "percentage",
      vendorPerformanceCommissionValue: 2,
    },
  },
];

export async function ensureSubscriptionDefaults() {
  await SubscriptionSettings.findOneAndUpdate(
    {},
    {
      $setOnInsert: {
        userQuarterlyDiscountDefault: 10,
        userAnnualDiscountDefault: 15,
        defaultDiscountFundedBy: "admin",
        eliteAccessRule: "Pro + High Rated",
        eliteMinRating: 4.7,
        eliteMinJobs: 25,
        providerDefaultCommissionRate: 15,
        providerLeadPriorityWindowMinutes: 5,
        vendorMonthlyFee: 4999,
        vendorPerformanceCommissionType: "percentage",
        vendorPerformanceCommissionValue: 2,
        vendorMarketingCreditsMonthly: 1000,
      },
    },
    { upsert: true, new: true }
  );

  /* Auto-seeding disabled for production
  for (const plan of DEFAULT_PLANS) {
    await SubscriptionPlan.findOneAndUpdate(
      { planId: plan.planId },
      { $setOnInsert: plan },
      { upsert: true, new: true }
    );
  }
  */
}

export async function getSubscriptionSettings() {
  await ensureSubscriptionDefaults();
  return (await SubscriptionSettings.findOne().lean()) || null;
}

export async function expireStaleSubscriptions(now = new Date()) {
  await UserSubscription.updateMany(
    {
      status: { $in: ["active", "pending_payment"] },
      currentPeriodEnd: { $lt: now },
    },
    {
      $set: {
        status: "expired",
        renewalStatus: "expired",
        endedAt: now,
        endedReason: "period_ended",
      },
    }
  );
}

export function addDays(baseDate, days) {
  const dt = new Date(baseDate);
  dt.setDate(dt.getDate() + Number(days || 0));
  return dt;
}

export async function getActiveSubscription(userId, userType, now = new Date()) {
  await expireStaleSubscriptions(now);
  const subscription = await UserSubscription.findOne({
    userId: String(userId),
    userType,
    status: "active",
    currentPeriodEnd: { $gte: now },
  }).sort({ currentPeriodEnd: -1 });
  if (!subscription) return null;
  const plan = await SubscriptionPlan.findOne({ planId: subscription.planId, isActive: true }).lean();
  if (!plan) return null;
  return { subscription, plan };
}

export async function getMarketingCreditsBalance(userId) {
  const rows = await SubscriptionLedger.find({
    userId: String(userId),
    userType: "vendor",
    entryType: { $in: ["marketing_credit_issue", "marketing_credit_usage"] },
  }).lean();
  return rows.reduce((sum, row) => {
    return sum + (row.direction === "credit" ? Number(row.amount || 0) : -Number(row.amount || 0));
  }, 0);
}

export function buildSubscriptionSnapshot({ userType, active, settings, marketingCreditsBalance = 0 }) {
  const now = new Date();
  const planMeta = active?.plan?.meta || {};
  const currentPeriodEnd = active?.subscription?.currentPeriodEnd || active?.subscription?.endDate || null;
  const daysLeft = currentPeriodEnd
    ? Math.max(Math.ceil((new Date(currentPeriodEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)), 0)
    : 0;

  return {
    isActive: !!active,
    daysLeft,
    planId: active?.plan?.planId || "",
    planName: active?.plan?.name || "",
    billingCycle: active?.plan?.billingCycle || "",
    price: Number(active?.plan?.price || 0),
    currentPeriodStart: active?.subscription?.currentPeriodStart || active?.subscription?.startDate || null,
    currentPeriodEnd: currentPeriodEnd || null,
    nextBillingAt: active?.subscription?.nextBillingAt || currentPeriodEnd || null,
    renewalStatus: active?.subscription?.renewalStatus || "manual",
    status: active?.subscription?.status || "inactive",
    benefits: active?.plan?.benefits || [],
    badgeLabel:
      userType === "customer"
        ? "SWM Plus"
        : userType === "provider"
        ? "SWM Pro"
        : userType === "vendor"
        ? "Enterprise"
        : "",
    isPlusMember: userType === "customer" && !!active,
    isPro: userType === "provider" && !!active,
    isEnterprise: userType === "vendor" && !!active,
    discountPercentage: Number(planMeta.discountPercentage || 0),
    minCartValueForDiscount: Number(planMeta.minCartValueForDiscount || 0),
    discountFundedBy: planMeta.discountFundedBy || settings?.defaultDiscountFundedBy || "admin",
    freeCancellationWindowHours: Number(planMeta.freeCancellationWindowHours || 0),
    zeroConvenienceFee: !!planMeta.zeroConvenienceFee,
    zeroTravelFee: !!planMeta.zeroTravelFee,
    priorityBookingEnabled: !!planMeta.priorityBookingEnabled,
    eliteAccessEnabled: !!planMeta.eliteAccessEnabled,
    eliteMinRating: Number(planMeta.eliteMinRating || settings?.eliteMinRating || 0),
    eliteMinJobs: Number(planMeta.eliteMinJobs || settings?.eliteMinJobs || 0),
    providerCommissionRate:
      planMeta.providerCommissionRate ?? planMeta.commissionRate ?? settings?.providerDefaultCommissionRate ?? null,
    leadPriorityWindowMinutes:
      Number(planMeta.leadPriorityWindowMinutes || settings?.providerLeadPriorityWindowMinutes || 0),
    premiumTrainingAccess: !!planMeta.premiumTrainingAccess,
    proBadgeEnabled: !!planMeta.proBadgeEnabled,
    boostedVisibilityEnabled: !!planMeta.boostedVisibilityEnabled,
    monthlyMarketingCredits:
      Number(planMeta.marketingCreditsMonthly || planMeta.marketingCredits || settings?.vendorMarketingCreditsMonthly || 0),
    marketingCreditsBalance: Number(marketingCreditsBalance || 0),
    prioritySupport: !!planMeta.prioritySupport,
    subAccountsEnabled: !!planMeta.subAccountsEnabled,
    vendorPerformanceCommissionType:
      planMeta.vendorPerformanceCommissionType || settings?.vendorPerformanceCommissionType || "percentage",
    vendorPerformanceCommissionValue:
      Number(planMeta.vendorPerformanceCommissionValue ?? settings?.vendorPerformanceCommissionValue ?? 0),
  };
}

export async function getSubscriptionSnapshot(userId, userType) {
  const settings = await getSubscriptionSettings();
  const active = await getActiveSubscription(userId, userType);
  const marketingCreditsBalance = userType === "vendor" && active
    ? await getMarketingCreditsBalance(userId)
    : 0;
  return buildSubscriptionSnapshot({ userType, active, settings, marketingCreditsBalance });
}

export async function createLedgerEntry(payload) {
  const row = await SubscriptionLedger.create(payload);
  return row;
}

export async function activateSubscription({
  userId,
  userType,
  plan,
  orderId,
  paymentId,
  signature,
  amountPaid,
  currency = "INR",
  now = new Date(),
}) {
  await expireStaleSubscriptions(now);

  const active = await UserSubscription.findOne({
    userId: String(userId),
    userType,
    status: "active",
  }).sort({ currentPeriodEnd: -1 });

  let subscription = await UserSubscription.findOne({
    userId: String(userId),
    userType,
    "paymentDetails.orderId": orderId,
  });
  if (!subscription && active && active.planId === plan.planId) {
    subscription = active;
  }

  const baseStart =
    active && active.planId === plan.planId && active.currentPeriodEnd > now
      ? new Date(active.currentPeriodEnd)
      : new Date(now);
  const periodStart =
    active && active.planId === plan.planId && active.currentPeriodEnd > now
      ? new Date(active.currentPeriodEnd)
      : new Date(now);
  const periodEnd = addDays(periodStart, plan.durationDays);

  if (active && active.planId !== plan.planId) {
    active.status = "cancelled";
    active.endedAt = now;
    active.endedReason = "replaced_by_new_plan";
    await active.save();
  }

  if (!subscription) {
    subscription = new UserSubscription({
      userId: String(userId),
      userType,
      planId: plan.planId,
      planName: plan.name,
      subscriptionId: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: "active",
      renewalStatus: "manual",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      startDate: periodStart,
      endDate: periodEnd,
      autoRenew: false,
      lastPaymentAt: now,
      nextBillingAt: periodEnd,
      paymentDetails: {
        gateway: "razorpay",
        paymentId,
        orderId,
        signature,
        amountPaid,
        currency,
      },
    });
  } else {
    subscription.planId = plan.planId;
    subscription.planName = plan.name;
    subscription.status = "active";
    subscription.renewalStatus = "manual";
    subscription.currentPeriodStart = baseStart;
    subscription.currentPeriodEnd = periodEnd;
    subscription.startDate = baseStart;
    subscription.endDate = periodEnd;
    subscription.lastPaymentAt = now;
    subscription.nextBillingAt = periodEnd;
    subscription.paymentDetails = {
      gateway: "razorpay",
      paymentId,
      orderId,
      signature,
      amountPaid,
      currency,
    };
  }

  await subscription.save();

  await createLedgerEntry({
    userId: String(userId),
    userType,
    subscriptionId: subscription.subscriptionId,
    planId: plan.planId,
    entryType: active && active.planId === plan.planId ? "renewal" : "purchase",
    direction: "debit",
    amount: Number(amountPaid || plan.price || 0),
    currency,
    meta: {
      orderId,
      paymentId,
      billingCycle: plan.billingCycle,
      periodStart,
      periodEnd,
    },
  });

  if (userType === "vendor") {
    const credits = Number(plan?.meta?.marketingCreditsMonthly || plan?.meta?.marketingCredits || 0);
    if (credits > 0) {
      const currentBalance = await getMarketingCreditsBalance(userId);
      await createLedgerEntry({
        userId: String(userId),
        userType,
        subscriptionId: subscription.subscriptionId,
        planId: plan.planId,
        entryType: "marketing_credit_issue",
        direction: "credit",
        amount: credits,
        balanceAfter: currentBalance + credits,
        meta: {
          reason: active && active.planId === plan.planId ? "renewal" : "activation",
          periodStart,
          periodEnd,
        },
      });
    }
  }

  const fresh = await getActiveSubscription(userId, userType);
  const settings = await getSubscriptionSettings();
  const marketingCreditsBalance = userType === "vendor" ? await getMarketingCreditsBalance(userId) : 0;
  return {
    subscription,
    snapshot: buildSubscriptionSnapshot({
      userType,
      active: fresh,
      settings,
      marketingCreditsBalance,
    }),
  };
}

export async function calculateCustomerSubscriptionBenefits({
  userId,
  total,
  subtotalAfterCoupon,
}) {
  const snapshot = await getSubscriptionSnapshot(userId, "customer");
  const discountBase = Number(subtotalAfterCoupon || 0);
  let subscriptionDiscount = 0;
  if (snapshot.isActive && snapshot.discountPercentage > 0 && discountBase >= snapshot.minCartValueForDiscount) {
    subscriptionDiscount = Math.round(discountBase * (snapshot.discountPercentage / 100));
  }
  return {
    snapshot,
    subscriptionDiscount,
    discountFundedBy: snapshot.discountFundedBy || "admin",
    convenienceFee: snapshot.zeroConvenienceFee ? 0 : 0,
    travelFee: snapshot.zeroTravelFee ? 0 : 0,
  };
}

export async function getProviderCommissionRate(providerId) {
  const active = await getActiveSubscription(providerId, "provider");
  if (active?.plan?.meta?.providerCommissionRate !== null && active?.plan?.meta?.providerCommissionRate !== undefined) {
    return Number(active.plan.meta.providerCommissionRate);
  }
  if (active?.plan?.meta?.commissionRate !== null && active?.plan?.meta?.commissionRate !== undefined) {
    return Number(active.plan.meta.commissionRate);
  }
  const commission = await CommissionSettings.findOne().lean();
  return Number(commission?.rate || 15);
}

export async function isEliteProvider(provider) {
  const settings = await getSubscriptionSettings();
  const snapshot = await getSubscriptionSnapshot(provider?._id?.toString?.() || provider?.id || provider?.phone || "", "provider");
  if (!snapshot.isPro) return false;
  const rating = Number(provider?.rating || 0);
  const totalJobs = Number(provider?.totalJobs || 0);
  return rating >= Number(snapshot.eliteMinRating || settings?.eliteMinRating || 0)
    && totalJobs >= Number(snapshot.eliteMinJobs || settings?.eliteMinJobs || 0);
}

export async function recordVendorPerformanceCommission({ vendorId, bookingId, amount, meta = {} }) {
  if (!(Number(amount) > 0)) return null;
  const balance = await getMarketingCreditsBalance(vendorId);
  return createLedgerEntry({
    userId: String(vendorId),
    userType: "vendor",
    subscriptionId: meta.subscriptionId || "",
    planId: meta.planId || "",
    entryType: "performance_commission",
    direction: "debit",
    amount: Number(amount),
    balanceAfter: balance,
    meta: { bookingId, ...meta },
  });
}
