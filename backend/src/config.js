import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const PORT = process.env.PORT;
export const MONGO_URI = process.env.MONGO_URI;
export const MONGO_DB = process.env.MONGO_DB;
export const REDIS_URL = process.env.REDIS_URL;
export const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || process.env.VITE_RAZORPAY_KEY_SECRET;
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:4173";
export const SWAGGER_SERVER_URL = process.env.SWAGGER_SERVER_URL || "";
export const DEMO_DEFAULT_PHONE = process.env.DEMO_DEFAULT_PHONE || "";
export const DEMO_DEFAULT_OTP = process.env.DEMO_DEFAULT_OTP || "";
export const DEMO_DEFAULT_OTP6 = process.env.DEMO_DEFAULT_OTP6 || "";
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

// SMS India Hub
export const SMSINDIAHUB_API_KEY = process.env.SMSINDIAHUB_API_KEY || "";
export const SMSINDIAHUB_SENDER_ID = process.env.SMSINDIAHUB_SENDER_ID || "SMSHUB";
export const SMSINDIAHUB_TEMPLATE_ID = process.env.SMSINDIAHUB_TEMPLATE_ID || "";
export const SMSINDIAHUB_ENTITY_ID = process.env.SMSINDIAHUB_ENTITY_ID || "";
export const SMSINDIAHUB_MESSAGE_TEMPLATE = process.env.SMSINDIAHUB_MESSAGE_TEMPLATE || "Your OTP is {otp}.";

// Default OTP allowlist
export const DEFAULT_USER_OTP_PHONE = process.env.DEFAULT_USER_OTP_PHONE || "9990000001";
export const DEFAULT_PROVIDER_OTP_PHONES = process.env.DEFAULT_PROVIDER_OTP_PHONES || "9100000001,9100000002,9100000003,9100000004";
export const DEFAULT_VENDOR_OTP_PHONE = process.env.DEFAULT_VENDOR_OTP_PHONE || "9999999999";
export const DEFAULT_USER_OTP = process.env.DEFAULT_USER_OTP || "1234";
export const DEFAULT_PROVIDER_OTP = process.env.DEFAULT_PROVIDER_OTP || "123456";
export const DEFAULT_VENDOR_OTP = process.env.DEFAULT_VENDOR_OTP || "123456";
