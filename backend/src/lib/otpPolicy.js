import {
  DEFAULT_USER_OTP_PHONE,
  DEFAULT_PROVIDER_OTP_PHONES,
  DEFAULT_VENDOR_OTP_PHONE,
  DEFAULT_USER_OTP,
  DEFAULT_PROVIDER_OTP,
  DEFAULT_VENDOR_OTP,
} from "../config.js";

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "").trim();
  // Return last 10 digits to handle +91, 0 prefixes etc for Indian numbers
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function parsePhones(raw) {
  return String(raw || "")
    .split(",")
    .map((p) => normalizePhone(p))
    .filter((p) => p.length > 0);
}

const defaultUserPhones = new Set(parsePhones(DEFAULT_USER_OTP_PHONE));
const defaultProviderPhones = new Set(parsePhones(DEFAULT_PROVIDER_OTP_PHONES));
const defaultVendorPhones = new Set(parsePhones(DEFAULT_VENDOR_OTP_PHONE));

export function isDefaultUserOtp(phone) {
  return defaultUserPhones.has(normalizePhone(phone));
}

export function isDefaultProviderOtp(phone) {
  const normalized = normalizePhone(phone);
  return defaultProviderPhones.has(normalized) || normalized === "9000001002";
}

export function isDefaultVendorOtp(phone) {
  return defaultVendorPhones.has(normalizePhone(phone));
}

export function isAllowlistedPhone(role, phone) {
  if (role === "user") return isDefaultUserOtp(phone);
  if (role === "provider") return isDefaultProviderOtp(phone);
  if (role === "vendor") return isDefaultVendorOtp(phone);
  return false;
}

export function getDefaultOtpByRole(role) {
  if (role === "user") return String(DEFAULT_USER_OTP || "123456");
  if (role === "provider") return String(DEFAULT_PROVIDER_OTP || "123456");
  if (role === "vendor") return String(DEFAULT_VENDOR_OTP || "123456");
  return "";
}
