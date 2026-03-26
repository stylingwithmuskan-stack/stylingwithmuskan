import {
  SMSINDIAHUB_API_KEY,
  SMSINDIAHUB_SENDER_ID,
  SMSINDIAHUB_TEMPLATE_ID,
  SMSINDIAHUB_ENTITY_ID,
  SMSINDIAHUB_MESSAGE_TEMPLATE,
} from "../config.js";

const SMSINDIAHUB_BASE_URL = "https://www.smsindiahub.in/api/mt/SendSMS";

function interpolate(template, vars = {}) {
  // Support both {otp} and ${otp} format
  return String(template || "")
    .replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""))
    .replace(/\$\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

function buildMessage(otp) {
  return interpolate(SMSINDIAHUB_MESSAGE_TEMPLATE || "Your OTP is {otp}.", { otp });
}

function buildUrl({ phone, message }) {
  const params = new URLSearchParams();
  params.set("apikey", SMSINDIAHUB_API_KEY);
  params.set("senderid", SMSINDIAHUB_SENDER_ID);
  params.set("number", phone);
  params.set("message", message);

  if (SMSINDIAHUB_TEMPLATE_ID) params.set("templateid", SMSINDIAHUB_TEMPLATE_ID);
  if (SMSINDIAHUB_ENTITY_ID) params.set("entityid", SMSINDIAHUB_ENTITY_ID);

  return `${SMSINDIAHUB_BASE_URL}?${params.toString()}`;
}

export async function sendOtpSms({ phone, otp }) {
  if (!SMSINDIAHUB_API_KEY) {
    console.warn("[SMS] Skip sending (API Key missing)");
    return { success: true, dummy: true };
  }

  try {
    const message = buildMessage(otp);
    const url = buildUrl({ phone, message });

    const res = await fetch(url, { method: "GET" });
    const text = await res.text();

    if (!res.ok) {
      throw new Error(`SMS India Hub failed (${res.status})`);
    }

    // Some gateways return 200 with an error string
    if (/error|invalid|failed/i.test(text || "")) {
      throw new Error(`SMS India Hub error: ${text}`);
    }

    return { success: true, raw: text };
  } catch (error) {
    console.error("[SMS ERROR]", error.message);
    throw error;
  }
}
