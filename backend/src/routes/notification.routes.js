import express from "express";
import { requireRole } from "../middleware/roles.js";
import { flexibleAuth } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import PushDevice from "../models/PushDevice.js";

import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";

const router = express.Router();

function getRecipientQuery(recipientId, recipientRole) {
  let query = { recipientRole };
  if (recipientRole === "vendor") {
    query.$or = [{ recipientId }, { recipientId: "GLOBAL_VENDOR_FALLBACK" }];
  } else if (recipientRole === "admin") {
    query.$or = [{ recipientId }, { recipientId: "GLOBAL_ADMIN_FALLBACK" }, { recipientId: "ADMIN001" }];
  } else {
    query.recipientId = recipientId;
  }
  return query;
}

// Public debug route for testing audio (No Auth required for testing)
router.get("/test-sound", async (req, res) => {
  try {
    const { recipientId, role = "provider", sound = "ringtone" } = req.query;
    if (!recipientId) return res.status(400).send("Missing recipientId query param. Example: /notifications/test-sound?recipientId=123&role=provider");
    
    const { notify } = await import("../lib/notify.js");
    await notify({
      recipientId,
      recipientRole: role,
      type: "booking_assigned",
      title: "🎵 Audio Alert Test",
      message: `If you hear this, your ${sound} is working correctly!`,
      meta: { sound },
      emit: true
    });
    
    res.send(`<h1>✅ Test Triggered</h1><p>Sound <b>'${sound}'</b> sent to <b>${role}</b> (ID: ${recipientId}).</p><p>Check your browser console for logs!</p>`);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get notifications for current user/role
router.get("/", flexibleAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    const baseQuery = getRecipientQuery(recipientId, recipientRole);
    const notifications = await Notification.find(baseQuery)
      .sort({ createdAt: -1 })
      .limit(50);
    
    const unreadCount = await Notification.countDocuments({ ...baseQuery, isRead: false });
    
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all as read
router.put("/read-all", flexibleAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    const baseQuery = getRecipientQuery(recipientId, recipientRole);
    await Notification.updateMany({ ...baseQuery, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark single notification as read
router.patch("/:id/read", flexibleAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    const baseQuery = getRecipientQuery(recipientId, recipientRole);
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...baseQuery },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/push/register", flexibleAuth, async (req, res) => {
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

    // AUTO-CLEANUP: Deactivate this fcmToken for OTHER users with the SAME role.
    // This ensures that if a different person logs in on the same device, the previous person stops receiving pushes.
    // We do NOT deactivate tokens for different roles on the same device, because this app supports
    // multi-role login (e.g., same person logged in as both "user" and "provider" simultaneously).
    await PushDevice.updateMany(
      { 
        fcmToken, 
        recipientRole,
        recipientId: { $ne: recipientId }
      },
      { $set: { isActive: false, lastError: "Token transferred to another session/user" } }
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

router.delete("/push/register", flexibleAuth, async (req, res) => {
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

router.get("/push/status", flexibleAuth, async (req, res) => {
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

router.patch("/push/preferences", flexibleAuth, async (req, res) => {
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
router.post("/push/test-self", flexibleAuth, async (req, res) => {
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
router.delete("/:id", flexibleAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    const baseQuery = getRecipientQuery(recipientId, recipientRole);
    await Notification.findOneAndDelete({ _id: req.params.id, ...baseQuery });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all notifications for the current user/role
router.delete("/", flexibleAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    const baseQuery = getRecipientQuery(recipientId, recipientRole);
    await Notification.deleteMany(baseQuery);
    res.json({ success: true, message: "All notifications deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete selected notifications (Bulk Delete)
router.post("/delete-multiple", flexibleAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const recipientRole = req.auth.role || "user";
    const { ids = [] } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "No IDs provided" });
    }

    const baseQuery = getRecipientQuery(recipientId, recipientRole);
    await Notification.deleteMany({ 
      _id: { $in: ids }, 
      ...baseQuery 
    });

    res.json({ success: true, message: `${ids.length} notifications deleted` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
