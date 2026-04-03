import { Router } from "express";
import { body, validationResult } from "express-validator";
import mongoose from "mongoose";
import User from "../models/User.js";
import { redis } from "../startup/redis.js";
import { issueToken } from "../middleware/auth.js";
import { issueOtp, OTP_LENGTH, verifyOtpValue } from "../lib/otpService.js";
import { getSubscriptionSnapshot } from "../lib/subscriptions.js";

const router = Router();

router.post(
  "/request-otp",
  body("phone").isString().matches(/^\d{10}$/),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { phone } = req.body;
    const intent = (req.body.intent || "auto").toLowerCase(); // "auto" | "login" | "register"
    const existing = await User.findOne({ phone }).lean();
    if (intent === "register" && existing) {
      return res.status(409).json({ error: "Account already exists. Please login." });
    }
    if (intent === "login" && !existing) {
      return res.status(404).json({ error: "No account found. Please register first." });
    }
    const isDev = (process.env.NODE_ENV !== "production");
    let issued;
    try {
      issued = await issueOtp({
        redis,
        key: `otp:${phone}`,
        phone,
        role: "user",
        intent,
      });
    } catch {
      return res.status(502).json({ error: "Failed to send OTP" });
    }
    const mask = "******";
    res.json({
      success: true,
      message: issued.message,
      deliveryMode: issued.deliveryMode,
      otpPreview: isDev ? issued.otp : mask,
      exists: !!existing,
      intent,
    });
  }
);

router.post(
  "/verify-otp",
  body("phone").isString().matches(/^\d{10}$/),
  body("otp").isString().isLength({ min: OTP_LENGTH, max: OTP_LENGTH }),
  async (req, res) => {
    console.log('[Auth] 🔐 OTP verification request:', {
      phone: req.body.phone,
      intent: req.body.intent || 'auto'
    });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error('[Auth] ❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { phone, otp } = req.body;
    const intent = (req.body.intent || "auto").toLowerCase();
    
    console.log('[Auth] Verifying OTP for phone:', phone);
    const valid = await verifyOtpValue({
      redis,
      key: `otp:${phone}`,
      phone,
      role: "user",
      otp,
    });
    
    if (!valid) {
      console.error('[Auth] ❌ Invalid OTP provided');
      return res.status(400).json({ error: "Invalid OTP" });
    }
    
    console.log('[Auth] ✅ OTP verified successfully');

    let user = await User.findOne({ phone });
    const exists = !!user;
    
    console.log('[Auth] User exists:', exists);
    
    if (intent === "login" && !exists) {
      console.error('[Auth] ❌ Login attempt for non-existent user');
      return res.status(404).json({ error: "No account found. Please register first." });
    }
    if (intent === "register" && exists) {
      console.error('[Auth] ❌ Registration attempt for existing user');
      return res.status(409).json({ error: "Account already exists. Please login." });
    }
    if (!exists) {
      console.log('[Auth] 📝 Creating new user with phone:', phone);
      try {
        user = await User.create({ phone, isVerified: true });
        console.log('[Auth] ✅ User created successfully:', {
          id: user._id,
          phone: user.phone,
          isVerified: user.isVerified
        });
        
        // Verify user was saved to database
        const savedUser = await User.findById(user._id);
        if (savedUser) {
          console.log('[Auth] ✅ User verified in database');
        } else {
          console.error('[Auth] ❌ User NOT found in database after creation!');
        }
      } catch (createError) {
        console.error('[Auth] ❌ Error creating user:', createError);
        throw createError;
      }
    } else {
      console.log('[Auth] 👤 Existing user found:', {
        id: user._id,
        phone: user.phone
      });
    }
    const isNew = !exists;
    const token = issueToken(user._id);
    const subscription = await getSubscriptionSnapshot(user._id.toString(), "customer");
    
    console.log('[Auth] ✅ Sending response with token and user data');
    
    res
      .cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .json({
        token,
        user: {
          _id: user._id,
          id: user._id,
          phone: user.phone,
          name: user.name,
          referralCode: user.referralCode,
          isVerified: user.isVerified,
          addresses: user.addresses,
          subscription,
          isPlusMember: subscription.isPlusMember,
          plusExpiry: subscription.currentPeriodEnd,
          plusPlan: subscription.planId,
          isNew,
        },
        intent,
      });
  }
);

router.post("/logout", (req, res) => {
  res.clearCookie("token").json({ success: true });
});

// DEBUG ENDPOINT - Test database write
router.post("/debug/test-db-write", async (req, res) => {
  try {
    console.log('[Debug] 🧪 Testing database write...');
    console.log('[Debug] Mongoose connection state:', mongoose.connection.readyState);
    console.log('[Debug] Database name:', mongoose.connection.name);
    console.log('[Debug] Database host:', mongoose.connection.host);
    
    const testPhone = `TEST${Date.now()}`;
    console.log('[Debug] Creating test user with phone:', testPhone);
    
    const testUser = await User.create({
      phone: testPhone,
      name: "Test User",
      isVerified: true
    });
    
    console.log('[Debug] ✅ Test user created:', {
      id: testUser._id,
      phone: testUser.phone,
      name: testUser.name
    });
    
    // Verify it was saved
    const found = await User.findById(testUser._id);
    console.log('[Debug] Verification - User found in DB:', !!found);
    
    // Count total users
    const totalUsers = await User.countDocuments();
    console.log('[Debug] Total users in database:', totalUsers);
    
    // List recent users
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('phone name createdAt');
    console.log('[Debug] Recent users:', recentUsers);
    
    res.json({
      success: true,
      testUser: {
        id: testUser._id,
        phone: testUser.phone,
        name: testUser.name
      },
      verification: {
        foundInDb: !!found,
        totalUsers,
        recentUsers
      },
      connection: {
        state: mongoose.connection.readyState,
        dbName: mongoose.connection.name,
        host: mongoose.connection.host
      }
    });
  } catch (error) {
    console.error('[Debug] ❌ Test failed:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const cookie = req.cookies?.token;
    if (!authHeader && !cookie) return res.status(401).json({ error: "Unauthorized" });
    // Reuse middleware without throwing
    const { issueToken } = await import("../middleware/auth.js");
    const jwt = (await import("jsonwebtoken")).default;
    const token =
      cookie ||
      (authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await (await import("../models/User.js")).default.findById(
      payload.sub
    );
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const subscription = await getSubscriptionSnapshot(user._id.toString(), "customer");
    res.json({
      user: {
        _id: user._id,
        id: user._id,
        phone: user.phone,
        name: user.name,
        referralCode: user.referralCode,
        isVerified: user.isVerified,
        addresses: user.addresses,
        subscription,
        isPlusMember: subscription.isPlusMember,
        plusExpiry: subscription.currentPeriodEnd,
        plusPlan: subscription.planId,
      },
    });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;
