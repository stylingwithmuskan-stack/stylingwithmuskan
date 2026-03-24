import { Router } from "express";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { redis } from "../startup/redis.js";
import { issueToken } from "../middleware/auth.js";

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
      return res.status(404).json({ error: "No account found. Please register." });
    }
    const isDev = (process.env.NODE_ENV !== "production");
    // Generate 4-digit OTP for user auth
    const otp = (Math.floor(1000 + Math.random() * 9000)).toString();

    await redis.set(`otp:${phone}`, otp, { EX: 300 });
    // In production, send via SMS here
    const mask = "****";
    console.log("[OTP] user login", phone, isDev ? otp : mask);
    res.json({
      success: true,
      message: "OTP sent",
      otpPreview: isDev ? otp : mask,
      exists: !!existing,
      intent,
    });
  }
);

router.post(
  "/verify-otp",
  body("phone").isString().matches(/^\d{10}$/),
  body("otp").isString().isLength({ min: 4, max: 4 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { phone, otp } = req.body;
    const intent = (req.body.intent || "auto").toLowerCase();
    const isDev = (process.env.NODE_ENV !== "production");
    const defaultOtp = process.env.DEMO_DEFAULT_OTP || (isDev ? "1234" : "");
    let valid = false;
    if (isDev && otp === defaultOtp) {
      valid = true;
    } else {
      const stored = await redis.get(`otp:${phone}`);
      valid = !!stored && stored === otp;
      if (valid) await redis.del(`otp:${phone}`);
    }
    if (!valid) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    let user = await User.findOne({ phone });
    const exists = !!user;
    if (intent === "login" && !exists) {
      return res.status(404).json({ error: "No account found. Please register." });
    }
    if (intent === "register" && exists) {
      return res.status(409).json({ error: "Account already exists. Please login." });
    }
    if (!exists) {
      user = await User.create({ phone, isVerified: true });
    }
    const isNew = !exists;
    const token = issueToken(user._id);
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
          id: user._id,
          phone: user.phone,
          name: user.name,
          referralCode: user.referralCode,
          isVerified: user.isVerified,
          addresses: user.addresses,
          isNew,
        },
        intent,
      });
  }
);

router.post("/logout", (req, res) => {
  res.clearCookie("token").json({ success: true });
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
    res.json({
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        referralCode: user.referralCode,
        isVerified: user.isVerified,
        addresses: user.addresses,
      },
    });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;
