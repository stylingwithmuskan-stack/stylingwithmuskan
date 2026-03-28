import SubscriptionPlan from "../../../models/SubscriptionPlan.js";
import UserSubscription from "../../../models/UserSubscription.js";
import SubscriptionLedger from "../../../models/SubscriptionLedger.js";
import { SubscriptionSettings } from "../../../models/Settings.js";
import { ensureSubscriptionDefaults, expireStaleSubscriptions, getMarketingCreditsBalance } from "../../../lib/subscriptions.js";

export async function getSettings(_req, res) {
  await ensureSubscriptionDefaults();
  const settings = await SubscriptionSettings.findOne().lean();
  res.json({ settings });
}

export async function updateSettings(req, res) {
  await ensureSubscriptionDefaults();
  const settings = await SubscriptionSettings.findOneAndUpdate({}, req.body || {}, {
    new: true,
    upsert: true,
    runValidators: true,
  }).lean();
  res.json({ settings });
}

export async function listPlans(_req, res) {
  await ensureSubscriptionDefaults();
  const plans = await SubscriptionPlan.find().sort({ userType: 1, sortOrder: 1, price: 1 }).lean();
  res.json({ plans });
}

export async function createPlan(req, res) {
  await ensureSubscriptionDefaults();
  const plan = await SubscriptionPlan.create(req.body || {});
  res.status(201).json({ plan });
}

export async function updatePlan(req, res) {
  const plan = await SubscriptionPlan.findOneAndUpdate(
    { planId: req.params.planId },
    req.body || {},
    { new: true, runValidators: true }
  ).lean();
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  res.json({ plan });
}

export async function report(_req, res) {
  await ensureSubscriptionDefaults();
  await expireStaleSubscriptions();

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [plans, active, expiringSoon, ledgerRows] = await Promise.all([
    SubscriptionPlan.find().lean(),
    UserSubscription.find({ status: "active", currentPeriodEnd: { $gte: now } }).lean(),
    UserSubscription.find({ status: "active", currentPeriodEnd: { $gte: now, $lte: in7Days } }).lean(),
    SubscriptionLedger.find().sort({ createdAt: -1 }).limit(500).lean(),
  ]);

  const activeByType = {
    customer: active.filter((s) => s.userType === "customer").length,
    provider: active.filter((s) => s.userType === "provider").length,
    vendor: active.filter((s) => s.userType === "vendor").length,
  };

  const revenue = ledgerRows
    .filter((row) => row.entryType === "purchase" || row.entryType === "renewal")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const vendorPerformanceCommission = ledgerRows
    .filter((row) => row.entryType === "performance_commission")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const adoptionByPlan = plans.map((plan) => ({
    planId: plan.planId,
    name: plan.name,
    userType: plan.userType,
    activeCount: active.filter((s) => s.planId === plan.planId).length,
  }));

  const vendorActiveIds = active.filter((s) => s.userType === "vendor").map((s) => s.userId);
  const vendorBalances = await Promise.all(
    vendorActiveIds.map(async (vendorId) => ({
      vendorId,
      balance: await getMarketingCreditsBalance(vendorId),
    }))
  );

  res.json({
    report: {
      activeByType,
      expiringSoon: expiringSoon.length,
      renewalRevenue: revenue,
      vendorPerformanceCommission,
      adoptionByPlan,
      vendorMarketingBalances: vendorBalances,
    },
  });
}
