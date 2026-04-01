import { getDefaultOtpByRole, isAllowlistedPhone } from "./otpPolicy.js";
import { sendOtpSms, validateSmsIndiaHubConfig } from "./smsIndiaHub.js";

export const OTP_LENGTH = 6;
export const OTP_TTL_SECONDS = 300;

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function maskPhone(phone) {
  const normalized = digitsOnly(phone);
  if (normalized.length < 4) return normalized || "unknown";
  return `${normalized.slice(0, 2)}******${normalized.slice(-2)}`;
}

function normalizeOtp(value, length = OTP_LENGTH) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return digits.slice(-length).padStart(length, "0");
}

function generateOtp(length = OTP_LENGTH) {
  const min = 10 ** (length - 1);
  const max = (10 ** length) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

function parseStoredOtpRecord(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return { otp: String(raw) };
}

function buildRequestMessage(deliveryMode) {
  return deliveryMode === "allowlist"
    ? "OTP is ready for verification."
    : "OTP sent to your mobile number.";
}

export async function issueOtp({
  redis,
  key,
  phone,
  role,
  intent = "auto",
  ttlSeconds = OTP_TTL_SECONDS,
}) {
  const allowlisted = isAllowlistedPhone(role, phone);
  const deliveryMode = allowlisted ? "allowlist" : "sms";
  const otp = allowlisted
    ? normalizeOtp(getDefaultOtpByRole(role))
    : generateOtp();

  const record = {
    phone: digitsOnly(phone),
    role,
    intent,
    otp,
    deliveryMode,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
  };

  await redis.set(key, JSON.stringify(record), { EX: ttlSeconds });

  if (deliveryMode === "sms") {
    try {
      validateSmsIndiaHubConfig();
      await sendOtpSms({ phone, otp, role, intent });
    } catch (error) {
      await redis.del(key);
      throw error;
    }
  }

  return {
    otp,
    deliveryMode,
    message: buildRequestMessage(deliveryMode),
  };
}

export async function verifyOtpValue({
  redis,
  key,
  phone,
  role,
  otp,
  deleteOnSuccess = true,
}) {
  const inputOtp = normalizeOtp(otp);
  const allowlistedOtp = normalizeOtp(getDefaultOtpByRole(role));

  if (isAllowlistedPhone(role, phone) && inputOtp === allowlistedOtp) {
    return true;
  }

  const storedRaw = await redis.get(key);
  const stored = parseStoredOtpRecord(storedRaw);
  const isValid = !!stored?.otp && normalizeOtp(stored.otp) === inputOtp;
  if (isValid && deleteOnSuccess) {
    await redis.del(key);
  }
  return isValid;
}
