import express from "express";
import { requireRole } from "../middleware/roles.js";
import { requireAuth } from "../middleware/auth.js";
import Notification from "../models/Notification.js";

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

// Delete a notification
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

export default router;
