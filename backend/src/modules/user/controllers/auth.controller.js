import { validationResult } from "express-validator";
import User from "../../../models/User.js";
import { redis } from "../../../startup/redis.js";
import { issueToken } from "../../../middleware/auth.js";
import { sendOtpSms } from "../../../lib/smsIndiaHub.js";
import { getDefaultOtpByRole, isDefaultUserOtp } from "../../../lib/otpPolicy.js";

import { ReferralSettings } from "../../../models/Settings.js";

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

  let user = await User.findOne({ phone });
  const isNewUser = !user;

  if (isNewUser) {
    user = new User({ 
      phone, 
      name, 
      isVerified: true,
      wallet: { balance: 0, transactions: [] }
    });
    
    // Process Referral if code provided
    if (referralCode && typeof referralCode === "string" && referralCode.trim()) {
      const cleanCode = referralCode.trim();
      const referrer = await User.findOne({ referralCode: cleanCode });
      
      if (referrer) {
        const settings = await ReferralSettings.findOne().lean() || { 
          referrerBonus: 100, 
          refereeBonus: 50, 
          maxReferrals: 10, 
          isActive: true 
        };

        if (settings.isActive) {
          user.referredBy = referrer._id.toString();
          user.appliedReferralCode = cleanCode;
          
          // Credit Referee (New User)
          const refereeBonus = Number(settings.refereeBonus || 0);
          if (refereeBonus > 0) {
            user.wallet.balance += refereeBonus;
            user.wallet.transactions.push({
              title: "Referral Bonus",
              amount: refereeBonus,
              type: "credit",
              balanceAfter: user.wallet.balance,
              description: `Welcome bonus for using referral code ${cleanCode}`
            });
          }

          // Credit Referrer
          const referrerBonus = Number(settings.referrerBonus || 0);
          const maxRefs = Number(settings.maxReferrals || 10);
          const currentRefs = await User.countDocuments({ referredBy: referrer._id.toString() });

          if (referrerBonus > 0 && currentRefs < maxRefs) {
            referrer.wallet.balance = (referrer.wallet.balance || 0) + referrerBonus;
            referrer.wallet.transactions.push({
              title: "Referral Reward",
              amount: referrerBonus,
              type: "credit",
              balanceAfter: referrer.wallet.balance,
              description: `Reward for referring ${name || phone}`
            });
            await referrer.save();
          }
        }
      } else {
        return res.status(400).json({ error: "Invalid referral code. Please enter a correct code." });
      }
    }
    await user.save();
  } else {
    // Existing user: Update name if provided and verify
    let needsSave = false;
    if (name && !user.name) {
      user.name = name;
      needsSave = true;
    }
    if (!user.isVerified) {
      user.isVerified = true;
      needsSave = true;
    }
    if (needsSave) await user.save();
  }
  const token = issueToken(user);
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ user: { ...user.toObject(), isNew: isNewUser } });
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
