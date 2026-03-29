import User from "../../../models/User.js";
import ProviderAccount from "../../../models/ProviderAccount.js";
import Vendor from "../../../models/Vendor.js";
import UserSubscription from "../../../models/UserSubscription.js";
import PushBroadcast from "../../../models/PushBroadcast.js";
import { notify } from "../../../lib/notify.js";

async function getActiveSubscriptionUserIds({ userType, planId = "", status = "" }) {
  const now = new Date();
  const query = {
    userType,
    status: status || "active",
    currentPeriodEnd: { $gte: now },
  };
  if (planId) query.planId = planId;
  const rows = await UserSubscription.find(query).select("userId").lean();
  return new Set(rows.map((row) => String(row.userId)));
}

async function collectAudience({ roles = [], city = "", subscriptionPlanId = "", subscriptionStatus = "" }) {
  const normalizedRoles = (Array.isArray(roles) ? roles : [roles]).map((role) => String(role || "").trim()).filter(Boolean);
  const recipients = [];

  if (normalizedRoles.includes("user")) {
    const users = await User.find(city ? { "addresses.city": { $regex: new RegExp(`^${city}$`, "i") } } : {})
      .select("_id")
      .lean();
    let allowedIds = null;
    if (subscriptionPlanId || subscriptionStatus) {
      allowedIds = await getActiveSubscriptionUserIds({
        userType: "customer",
        planId: subscriptionPlanId,
        status: subscriptionStatus || "active",
      });
    }
    users.forEach((user) => {
      const id = String(user._id);
      if (!allowedIds || allowedIds.has(id)) recipients.push({ recipientId: id, recipientRole: "user" });
    });
  }

  if (normalizedRoles.includes("provider")) {
    const providers = await ProviderAccount.find(city ? { city: { $regex: new RegExp(`^${city}$`, "i") } } : {})
      .select("_id")
      .lean();
    let allowedIds = null;
    if (subscriptionPlanId || subscriptionStatus) {
      allowedIds = await getActiveSubscriptionUserIds({
        userType: "provider",
        planId: subscriptionPlanId,
        status: subscriptionStatus || "active",
      });
    }
    providers.forEach((provider) => {
      const id = String(provider._id);
      if (!allowedIds || allowedIds.has(id)) recipients.push({ recipientId: id, recipientRole: "provider" });
    });
  }

  if (normalizedRoles.includes("vendor")) {
    const vendors = await Vendor.find(city ? { city: { $regex: new RegExp(`^${city}$`, "i") } } : {})
      .select("_id")
      .lean();
    let allowedIds = null;
    if (subscriptionPlanId || subscriptionStatus) {
      allowedIds = await getActiveSubscriptionUserIds({
        userType: "vendor",
        planId: subscriptionPlanId,
        status: subscriptionStatus || "active",
      });
    }
    vendors.forEach((vendor) => {
      const id = String(vendor._id);
      if (!allowedIds || allowedIds.has(id)) recipients.push({ recipientId: id, recipientRole: "vendor" });
    });
  }

  const unique = new Map();
  recipients.forEach((item) => {
    unique.set(`${item.recipientRole}:${item.recipientId}`, item);
  });
  return Array.from(unique.values());
}

export async function broadcast(req, res) {
  try {
    const {
      roles = [],
      city = "",
      subscriptionPlanId = "",
      subscriptionStatus = "",
      title = "",
      message = "",
      link = "/notifications",
      icon = "",
    } = req.body || {};

    if (!title || !message || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ error: "roles, title, and message are required" });
    }

    const audience = await collectAudience({ roles, city, subscriptionPlanId, subscriptionStatus });
    const history = await PushBroadcast.create({
      createdBy: String(req.auth?.sub || "ADMIN001"),
      title,
      message,
      link,
      icon,
      filters: {
        roles,
        city,
        subscriptionPlanId,
        subscriptionStatus,
      },
      stats: {
        targeted: audience.length,
      },
    });

    let notificationsCreated = 0;
    for (const recipient of audience) {
      // eslint-disable-next-line no-await-in-loop
      const created = await notify({
        recipientId: recipient.recipientId,
        recipientRole: recipient.recipientRole,
        type: "marketing_campaign",
        title,
        message,
        link,
        meta: {
          title,
          message,
          icon,
          broadcastId: history._id.toString(),
          filters: history.filters,
        },
      });
      if (created) notificationsCreated += 1;
    }

    history.stats.notificationsCreated = notificationsCreated;
    history.stats.pushSent = notificationsCreated;
    await history.save();

    res.json({
      success: true,
      history,
      targeted: audience.length,
      notificationsCreated,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to send broadcast" });
  }
}

export async function history(_req, res) {
  try {
    const items = await PushBroadcast.find().sort({ createdAt: -1 }).limit(50).lean();
    res.json({ broadcasts: items });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to load broadcast history" });
  }
}

export async function test(req, res) {
  try {
    const adminId = String(req.auth?.sub || "ADMIN001");
    const notification = await notify({
      recipientId: adminId,
      recipientRole: "admin",
      type: "marketing_campaign",
      title: "Push Test",
      message: "Firebase push test notification from admin panel.",
      link: "/admin/notifications",
      meta: {
        title: "Push Test",
        message: "Firebase push test notification from admin panel.",
      },
    });
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to send test push" });
  }
}
