import { validationResult } from "express-validator";
import User from "../../../models/User.js";
import { redis } from "../../../startup/redis.js";
import { issueToken } from "../../../middleware/auth.js";
import { sendOtpSms } from "../../../lib/smsIndiaHub.js";
import { getDefaultOtpByRole, isDefaultUserOtp } from "../../../lib/otpPolicy.js";

export async function requestOtp(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const phone = req.body.phone;
  const isDefaultPhone = isDefaultUserOtp(phone);
  const otp = isDefaultPhone ? getDefaultOtpByRole("user") : (Math.floor(100000 + Math.random() * 900000)).toString();
  await redis.set(`otp:${req.body.phone}`, otp, { EX: 300 });
  if (!isDefaultPhone) {
    try {
      await sendOtpSms({ phone, otp });
    } catch {
      await redis.del(`otp:${phone}`);
      return res.status(502).json({ error: "Failed to send OTP" });
    }
  }
  res.json({ success: true });
}

export async function verifyOtp(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { phone, otp, name, referralCode } = req.body;
  let valid = false;
  if (isDefaultUserOtp(phone) && otp === getDefaultOtpByRole("user")) valid = true;
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
