import { Router } from "express";
import mongoose from "mongoose";
import { requireRole, requireAnyRole } from "../middleware/roles.js";
import SupportChat from "../models/SupportChat.js";
import ProviderAccount from "../models/ProviderAccount.js";
import Vendor from "../models/Vendor.js";

const router = Router();

// ─────────────────────────────────────────
// GENERIC USER ENDPOINTS (Provider/Vendor)
// ─────────────────────────────────────────

// POST /support/chat — User sends a message to admin
router.post("/chat", requireAnyRole(["provider", "vendor"]), async (req, res) => {
  try {
    const { message } = req.body;
    const role = req.auth.role;
    const userId = req.auth.sub;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    let userData;
    if (role === "provider") {
      userData = await ProviderAccount.findById(userId).select("name phone").lean();
    } else if (role === "vendor") {
      userData = await Vendor.findById(userId).select("name email phone").lean();
    }

    if (!userData) return res.status(404).json({ error: "User not found" });

    const chat = await SupportChat.create({
      participantId: userId,
      participantName: userData.name || userData.businessName || "",
      participantPhone: userData.phone || "",
      participantRole: role,
      sender: role,
      message: String(message).trim(),
    });

    return res.status(201).json({ chat });
  } catch (err) {
    console.error("[Support] Error sending message:", err);
    return res.status(500).json({ error: "Failed to send message" });
  }
});

// GET /support/chat — User fetches their own chat history
router.get("/chat", requireAnyRole(["provider", "vendor"]), async (req, res) => {
  try {
    const messages = await SupportChat.find({ participantId: req.auth.sub })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ messages });
  } catch (err) {
    console.error("[Support] Error fetching messages:", err);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ─────────────────────────────────────────
// ADMIN ENDPOINTS
// ─────────────────────────────────────────

// GET /support/admin/conversations — List all participants who have chatted
router.get("/admin/conversations", requireRole("admin"), async (req, res) => {
  try {
    const conversations = await SupportChat.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$participantId",
          participantName: { $first: "$participantName" },
          participantPhone: { $first: "$participantPhone" },
          participantRole: { $first: "$participantRole" },
          lastMessage: { $first: "$message" },
          lastSender: { $first: "$sender" },
          lastMessageAt: { $first: "$createdAt" },
          totalMessages: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ["$sender", "admin"] }, { $eq: ["$read", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastMessageAt: -1 } },
      {
        $project: {
          _id: 0,
          participantId: "$_id",
          participantName: 1,
          participantPhone: 1,
          participantRole: 1,
          lastMessage: 1,
          lastSender: 1,
          lastMessageAt: 1,
          totalMessages: 1,
          unreadCount: 1,
        },
      },
    ]);

    return res.json({ conversations });
  } catch (err) {
    console.error("[Support] Error fetching conversations:", err);
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// GET /support/admin/chat/:participantId — Get full chat thread for a specific participant
router.get("/admin/chat/:participantId", requireRole("admin"), async (req, res) => {
  try {
    const { participantId } = req.params;
    if (!mongoose.isValidObjectId(participantId)) {
      return res.status(400).json({ error: "Invalid participant ID" });
    }

    // Mark all participant messages as read
    await SupportChat.updateMany(
      { participantId, sender: { $ne: "admin" }, read: false },
      { $set: { read: true } }
    );

    const messages = await SupportChat.find({ participantId })
      .sort({ createdAt: 1 })
      .lean();

    // Try to get participant info from either model
    let participant = await ProviderAccount.findById(participantId)
      .select("name phone profilePhoto city")
      .lean();
    
    if (!participant) {
      participant = await Vendor.findById(participantId)
        .select("name email phone city")
        .lean();
      if (participant) participant.role = "vendor";
    } else {
      participant.role = "provider";
    }

    return res.json({ messages, participant });
  } catch (err) {
    console.error("[Support] Error fetching chat:", err);
    return res.status(500).json({ error: "Failed to fetch chat" });
  }
});

// POST /support/admin/chat/:participantId — Admin replies to a specific participant
router.post("/admin/chat/:participantId", requireRole("admin"), async (req, res) => {
  try {
    const { participantId } = req.params;
    const { message } = req.body;

    if (!mongoose.isValidObjectId(participantId)) {
      return res.status(400).json({ error: "Invalid participant ID" });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Get the last message to find participant info
    const lastMsg = await SupportChat.findOne({ participantId }).sort({ createdAt: -1 }).lean();
    if (!lastMsg) return res.status(404).json({ error: "Conversation not found" });

    const chat = await SupportChat.create({
      participantId,
      participantName: lastMsg.participantName,
      participantPhone: lastMsg.participantPhone,
      participantRole: lastMsg.participantRole,
      sender: "admin",
      message: String(message).trim(),
    });

    return res.status(201).json({ chat });
  } catch (err) {
    console.error("[Support] Error sending reply:", err);
    return res.status(500).json({ error: "Failed to send reply" });
  }
});

export default router;
