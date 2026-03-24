import { validationResult } from "express-validator";
import User from "../../../models/User.js";
import { redis } from "../../../startup/redis.js";
import { issueToken } from "../../../middleware/auth.js";

export async function requestOtp(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const otp = (Math.floor(1000 + Math.random() * 9000)).toString();
  await redis.set(`otp:${req.body.phone}`, otp, { EX: 300 });
  res.json({ success: true });
}

export async function verifyOtp(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { phone, otp, name, referralCode } = req.body;
  const defaultPhone = process.env.DEMO_DEFAULT_PHONE || "";
  const allowedDefaultOtps = new Set([process.env.DEMO_DEFAULT_OTP, process.env.DEMO_DEFAULT_OTP6].filter(Boolean));
  let valid = false;
  if (phone === defaultPhone && allowedDefaultOtps.has(otp)) valid = true;
  else {
    const stored = await redis.get(`otp:${phone}`);
    if (stored && stored === otp) {
      valid = true;
      await redis.del(`otp:${phone}`);
    }
  }
  if (!valid) return res.status(400).json({ error: "Invalid OTP" });
  let user = await User.findOneAndUpdate(
    { phone },
    { $setOnInsert: { phone }, $set: { isVerified: true, name: name || undefined, referralCode: referralCode || undefined } },
    { new: true, upsert: true }
  );
  const token = issueToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ user });
}

export async function logout(req, res) {
  res.clearCookie("token").json({ success: true });
}

export async function me(req, res) {
  try {
    if (!req.cookies?.token) throw new Error("No token");
    res.json({ user: req.user });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}
