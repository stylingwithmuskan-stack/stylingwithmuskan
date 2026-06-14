import User from "../../../models/User.js";
import ProviderAccount from "../../../models/ProviderAccount.js";
import Vendor from "../../../models/Vendor.js";
import UserSubscription from "../../../models/UserSubscription.js";
import PushBroadcast from "../../../models/PushBroadcast.js";
import { notify } from "../../../lib/notify.js";
import mongoose from "mongoose";
import { uploadBase64Image } from "../../../startup/cloudinary.js";

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

  const cleanCity = String(city || "").trim();
  const isAllCities = !cleanCity || cleanCity.toLowerCase() === "all cities";
  const cityFilter = isAllCities ? null : { $regex: new RegExp(`^${cleanCity}$`, "i") };

  if (normalizedRoles.includes("user")) {
    const users = await User.find(cityFilter ? { "addresses.city": cityFilter } : {})
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
    const providers = await ProviderAccount.find(cityFilter ? { city: cityFilter } : {})
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
    const vendors = await Vendor.find(cityFilter ? { city: cityFilter } : {})
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
      image = "",
    } = req.body || {};

    if (!title || !message || !Array.isArray(roles) || roles.length === 0) {
      return res.status(400).json({ error: "roles, title, and message are required" });
    }

    const audience = await collectAudience({ roles, city, subscriptionPlanId, subscriptionStatus });
    
    // Process base64 images if present
    const finalIcon = await uploadBase64Image(icon, "marketing-icons");
    const finalImage = await uploadBase64Image(image, "marketing-images");

    const history = await PushBroadcast.create({
      createdBy: String(req.auth?.sub || "ADMIN001"),
      title,
      message,
      link,
      icon: finalIcon,
      image: finalImage,
      filters: {
        roles,
        city,
        subscriptionPlanId,
        subscriptionStatus,
      },
      stats: {
        targeted: audience.length,
        notificationsCreated: audience.length,
        pushSent: 0,
        pushFailed: 0,
      },
    });

    // Start background task to send notifications and later update history stats
    (async () => {
      try {
        let createdCount = 0;
        for (const recipient of audience) {
          const created = await notify({
            recipientId: recipient.recipientId,
            recipientRole: recipient.recipientRole,
            type: "marketing_campaign",
            title,
            message,
            link,
            respectProviderQuietHours: false,
            meta: {
              title,
              message,
              icon: finalIcon,
              image: finalImage,
              broadcastId: history._id.toString(),
              filters: history.filters,
            },
          });
          if (created) createdCount++;
        }

        // Wait a tiny bit (2 seconds) to allow Firebase Admin calls in notify to resolve
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Dynamically count sent/failed notifications for this broadcast ID
        const [sent, failed] = await Promise.all([
          mongoose.model("Notification").countDocuments({
            "meta.broadcastId": history._id.toString(),
            "delivery.push.status": "sent",
          }),
          mongoose.model("Notification").countDocuments({
            "meta.broadcastId": history._id.toString(),
            "delivery.push.status": "failed",
          }),
        ]);

        history.stats.notificationsCreated = createdCount;
        history.stats.pushSent = sent;
        history.stats.pushFailed = failed;
        await history.save();
        console.log(`[push] Broadcast campaign ${history._id} completed: targeted=${audience.length}, created=${createdCount}, sent=${sent}, failed=${failed}`);
      } catch (err) {
        console.error("[push] Async broadcast error:", err.message);
      }
    })();

    res.json({
      success: true,
      history,
      targeted: audience.length,
      notificationsCreated: audience.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unable to send broadcast" });
  }
}

export async function history(_req, res) {
  try {
    const items = await PushBroadcast.find().sort({ createdAt: -1 }).limit(50).lean();
    
    // Dynamically query real-time counts from Notification model for absolute accuracy
    const broadcastIds = items.map((item) => String(item._id));
    
    const liveStats = await mongoose.model("Notification").aggregate([
      { $match: { "meta.broadcastId": { $in: broadcastIds } } },
      {
        $group: {
          _id: "$meta.broadcastId",
          sent: {
            $sum: { $cond: [{ $eq: ["$delivery.push.status", "sent"] }, 1, 0] }
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$delivery.push.status", "failed"] }, 1, 0] }
          }
        }
      }
    ]);
    
    const statsMap = new Map(liveStats.map((s) => [String(s._id), s]));
    
    const updatedItems = items.map((item) => {
      const live = statsMap.get(String(item._id));
      if (live) {
        return {
          ...item,
          stats: {
            ...item.stats,
            pushSent: live.sent,
            pushFailed: live.failed
          }
        };
      }
      return item;
    });

    res.json({ broadcasts: updatedItems });
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
