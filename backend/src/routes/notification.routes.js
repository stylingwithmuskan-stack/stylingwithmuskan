import express from "express";
import { requireRole } from "../middleware/roles.js";
import { requireAuth } from "../middleware/auth.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Helper to check for ANY role or standard user auth
const requireAnyAuth = async (req, res, next) => {
  // First try standard user auth
  try {
    return await requireAuth(req, res, (err) => {
      if (!err && req.user) {
        req.auth = { sub: req.user._id.toString(), role: "user" };
        return next();
      }
      throw new Error("Not a user");
    });
  } catch (e) {
    // If not user, try roles (admin, provider, vendor)
    const roles = ["admin", "provider", "vendor"];
    for (const role of roles) {
      const middleware = requireRole(role);
      let success = false;
      middleware(req, res, (err) => {
        if (!err && req.auth) {
          success = true;
        }
      });
      if (success) return next();
    }
  }
  return res.status(401).json({ error: "Unauthorized" });
};

// Get notifications for current user/role
router.get("/", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    const notifications = await Notification.find({ recipientId })
      .sort({ createdAt: -1 })
      .limit(50);
    
    const unreadCount = await Notification.countDocuments({ recipientId, isRead: false });
    
    res.json({ notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all as read
router.put("/read-all", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    await Notification.updateMany({ recipientId, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a notification
router.delete("/:id", requireAnyAuth, async (req, res) => {
  try {
    const recipientId = req.auth.sub;
    await Notification.findOneAndDelete({ _id: req.params.id, recipientId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
