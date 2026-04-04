import { Router } from "express";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { requireRole, requireAnyRole } from "../middleware/roles.js";
import User from "../models/User.js";
import ProviderAccount from "../models/ProviderAccount.js";
import Vendor from "../models/Vendor.js";
import AdminAccount from "../models/AdminAccount.js";
import PushDevice from "../models/PushDevice.js";

const router = Router();

function normalizeToken(raw) {
  return String(raw || "").trim();
}

function normalizePlatform(raw) {
  return String(raw || "web").trim() || "web";
}

function deviceKeyFromToken(token) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return `fcm_${hash.slice(0, 32)}`;
}

async function upsertRoleToken(Model, filter, token, platform) {
  const now = new Date();
  const updateExisting = await Model.updateOne(
    { ...filter, "fcmTokens.token": token },
    {
      $set: {
        "fcmTokens.$.platform": platform,
        "fcmTokens.$.lastSeenAt": now,
        "fcmTokens.$.isActive": true,
      },
    }
  );

  if (updateExisting?.matchedCount > 0) return;

  await Model.updateOne(
    filter,
    {
      $push: {
        fcmTokens: {
          token,
          platform,
          lastSeenAt: now,
          isActive: true,
        },
      },
    }
  );
}

async function removeRoleToken(Model, filter, token) {
  await Model.updateOne(filter, { $pull: { fcmTokens: { token } } });
}

async function upsertPushDevice(recipientId, recipientRole, token, platform) {
  const now = new Date();
  const deviceKey = deviceKeyFromToken(token);
  await PushDevice.findOneAndUpdate(
    { recipientId, recipientRole, deviceKey },
    {
      recipientId,
      recipientRole,
      fcmToken: token,
      platform,
      deviceKey,
      permission: "granted",
      isActive: true,
      lastSeenAt: now,
      preferences: { enabled: true },
      lastError: "",
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function deactivatePushDevice(recipientId, recipientRole, token) {
  await PushDevice.updateMany(
    { recipientId, recipientRole, fcmToken: token },
    {
      $set: {
        isActive: false,
        lastError: "Unregistered by client logout",
      },
    }
  );
}

router.post("/users/fcm-tokens/save", requireAuth, async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    const platform = normalizePlatform(req.body?.platform);
    if (!token) return res.status(400).json({ error: "token is required" });

    const userId = String(req.user?._id || "");
    await upsertRoleToken(User, { _id: userId }, token, platform);
    await upsertPushDevice(userId, "user", token, platform);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

router.post("/users/fcm-tokens/remove", requireAuth, async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    if (!token) return res.status(400).json({ error: "token is required" });

    const userId = String(req.user?._id || "");
    await removeRoleToken(User, { _id: userId }, token);
    await deactivatePushDevice(userId, "user", token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

router.post("/providers/fcm-tokens/save", requireRole("provider"), async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    const platform = normalizePlatform(req.body?.platform);
    if (!token) return res.status(400).json({ error: "token is required" });

    const providerId = String(req.auth?.sub || "");
    await upsertRoleToken(ProviderAccount, { _id: providerId }, token, platform);
    await upsertPushDevice(providerId, "provider", token, platform);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

router.post("/providers/fcm-tokens/remove", requireRole("provider"), async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    if (!token) return res.status(400).json({ error: "token is required" });

    const providerId = String(req.auth?.sub || "");
    await removeRoleToken(ProviderAccount, { _id: providerId }, token);
    await deactivatePushDevice(providerId, "provider", token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

router.post("/vendors/fcm-tokens/save", requireRole("vendor"), async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    const platform = normalizePlatform(req.body?.platform);
    if (!token) return res.status(400).json({ error: "token is required" });

    const vendorId = String(req.auth?.sub || "");
    await upsertRoleToken(Vendor, { _id: vendorId }, token, platform);
    await upsertPushDevice(vendorId, "vendor", token, platform);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

router.post("/vendors/fcm-tokens/remove", requireRole("vendor"), async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    if (!token) return res.status(400).json({ error: "token is required" });

    const vendorId = String(req.auth?.sub || "");
    await removeRoleToken(Vendor, { _id: vendorId }, token);
    await deactivatePushDevice(vendorId, "vendor", token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

router.post("/admins/fcm-tokens/save", requireRole("admin"), async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    const platform = normalizePlatform(req.body?.platform);
    if (!token) return res.status(400).json({ error: "token is required" });

    const adminId = String(req.auth?.sub || "");
    const admin = await AdminAccount.findOne({ adminId });
    if (!admin) {
      await AdminAccount.create({ adminId, fcmTokens: [] });
    }
    await upsertRoleToken(AdminAccount, { adminId }, token, platform);
    await upsertPushDevice(adminId, "admin", token, platform);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

router.post("/admins/fcm-tokens/remove", requireRole("admin"), async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    if (!token) return res.status(400).json({ error: "token is required" });

    const adminId = String(req.auth?.sub || "");
    await removeRoleToken(AdminAccount, { adminId }, token);
    await deactivatePushDevice(adminId, "admin", token);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// Common endpoint for both vendor and provider
router.post("/business/fcm-tokens/save", requireAnyRole(["vendor", "provider"]), async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    const platform = normalizePlatform(req.body?.platform);
    if (!token) return res.status(400).json({ error: "token is required" });

    const role = req.auth?.role;
    const userId = String(req.auth?.sub || "");

    if (role === "vendor") {
      await upsertRoleToken(Vendor, { _id: userId }, token, platform);
      await upsertPushDevice(userId, "vendor", token, platform);
    } else if (role === "provider") {
      await upsertRoleToken(ProviderAccount, { _id: userId }, token, platform);
      await upsertPushDevice(userId, "provider", token, platform);
    }

    res.json({ success: true, role });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

router.post("/business/fcm-tokens/remove", requireAnyRole(["vendor", "provider"]), async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    if (!token) return res.status(400).json({ error: "token is required" });

    const role = req.auth?.role;
    const userId = String(req.auth?.sub || "");

    if (role === "vendor") {
      await removeRoleToken(Vendor, { _id: userId }, token);
      await deactivatePushDevice(userId, "vendor", token);
    } else if (role === "provider") {
      await removeRoleToken(ProviderAccount, { _id: userId }, token);
      await deactivatePushDevice(userId, "provider", token);
    }

    res.json({ success: true, role });
  } catch (err) {
    res.status(500).json({ error: err.message || "Server error" });
  }
});

export default router;
