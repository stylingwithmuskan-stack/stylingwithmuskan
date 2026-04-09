import express from "express";
import { requireRole } from "../middleware/roles.js";
import { requireAuth } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import PushDevice from "../models/PushDevice.js";

import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

const router = express.Router();

// Helper to check for ANY role or standard user auth
const requireAnyAuth = async (req, res, next) => {
  try {
    const cookies = req.cookies || {};
    const headerToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;

    const candidates = [
      headerToken,
      cookies.token,
      cookies.providerToken,
      cookies.adminToken,
      cookies.vendorToken,
    ].filter(Boolean);

    let decoded = null;
    for (const t of candidates) {
      try {
        decoded = jwt.verify(t, JWT_SECRET);
        if (decoded) break;
      } catch {}
    }

    if (!decoded) return res.status(401).json({ error: "Unauthorized" });
    
    req.auth = decoded;
    // Back-compat for some middlewares that expect req.user
    if (decoded.role === "user") {
      req.user = { _id: decoded.sub };
    }
    
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

// Get notifications for current user/role
router.get("/", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    const notifications = await Notification.find({ recipientId, recipientRole })
      .sort({ createdAt: -1 })
      .limit(50);
    
    const unreadCount = await Notification.countDocuments({ recipientId, recipientRole, isRead: false });
    
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all as read
router.put("/read-all", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    await Notification.updateMany({ recipientId, recipientRole, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/push/register", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = String(req.auth.sub);
    const recipientRole = req.auth.role || "user";
    const body = req.body || {};
    // Accept both { token, platform } (SOP style) and { fcmToken, deviceKey } (internal style)
    const fcmToken = body.fcmToken || body.token || "";
    const platform = body.platform || "web";
    const deviceKey = body.deviceKey || body.token || "";  // fall back to token as deviceKey if not provided
    const permission = body.permission || "granted";
    const enabled = body.enabled !== false;

    if (!fcmToken) {
      return res.status(400).json({ error: "token (or fcmToken) is required" });
    }

    const device = await PushDevice.findOneAndUpdate(
      { recipientId, recipientRole, deviceKey },
      {
        recipientId,
        recipientRole,
        fcmToken,
        platform,
        deviceKey,
        permission,
        isActive: true,
        lastSeenAt: new Date(),
        preferences: { enabled: enabled !== false },
        lastError: "",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      device: {
        deviceKey: device.deviceKey,
        isActive: device.isActive,
        permission: device.permission,
        enabled: device.preferences?.enabled !== false,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/push/register", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = String(req.auth.sub);
    const recipientRole = req.auth.role || "user";
    const { deviceKey = "", fcmToken = "" } = req.body || {};
    if (!deviceKey && !fcmToken) {
      return res.status(400).json({ error: "deviceKey or fcmToken is required" });
    }
    await PushDevice.updateMany(
      {
        recipientId,
        recipientRole,
        ...(deviceKey ? { deviceKey } : {}),
        ...(fcmToken ? { fcmToken } : {}),
      },
      {
        $set: {
          isActive: false,
          lastError: "Unregistered by client logout",
        },
      }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/push/status", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = String(req.auth.sub);
    const recipientRole = req.auth.role || "user";
    const deviceKey = String(req.query.deviceKey || "").trim();
    if (!deviceKey) {
      return res.status(400).json({ error: "deviceKey is required" });
    }
    const device = await PushDevice.findOne({ recipientId, recipientRole, deviceKey }).lean();
    res.json({
      supported: true,
      registered: !!(device?.isActive),
      permission: device?.permission || "default",
      enabled: device?.preferences?.enabled !== false,
      device: device
        ? {
            deviceKey: device.deviceKey,
            lastSeenAt: device.lastSeenAt,
            lastSuccessAt: device.lastSuccessAt,
            lastError: device.lastError,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/push/preferences", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = String(req.auth.sub);
    const recipientRole = req.auth.role || "user";
    const { deviceKey = "", enabled = true, permission = "default" } = req.body || {};
    if (!deviceKey) return res.status(400).json({ error: "deviceKey is required" });

    const device = await PushDevice.findOneAndUpdate(
      { recipientId, recipientRole, deviceKey },
      {
        $set: {
          permission,
          "preferences.enabled": enabled !== false,
          isActive: enabled !== false,
          lastSeenAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    res.json({
      success: true,
      device: device || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a test push notification to the current user's own devices
router.post("/push/test-self", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = String(req.auth.sub);
    const recipientRole = req.auth.role || "user";
    const { notify } = await import("../lib/notify.js");
    const notification = await notify({
      recipientId,
      recipientRole,
      type: "marketing_campaign",
      title: "🔔 Test Push Notification",
      message: "Push notifications are working correctly on your device!",
      link: "/notifications",
      meta: { title: "Test Push", message: "Push notifications are working!" },
    });
    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a single notification
router.delete("/:id", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    await Notification.findOneAndDelete({ _id: req.params.id, recipientId, recipientRole });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all notifications for the current user/role
router.delete("/", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    await Notification.deleteMany({ recipientId, recipientRole });
    res.json({ success: true, message: "All notifications deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete selected notifications (Bulk Delete)
router.post("/delete-multiple", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    const { ids = [] } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No IDs provided" });
    }

    await Notification.deleteMany({ 
      _id: { $in: ids }, 
      recipientId, 
      recipientRole 
    });

    res.json({ success: true, message: `${ids.length} notifications deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
