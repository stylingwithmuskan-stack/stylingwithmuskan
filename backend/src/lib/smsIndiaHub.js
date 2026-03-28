import {
  SMSINDIAHUB_API_KEY,
  SMSINDIAHUB_SENDER_ID,
  SMSINDIAHUB_TEMPLATE_ID,
  SMSINDIAHUB_ENTITY_ID,
  SMSINDIAHUB_MESSAGE_TEMPLATE,
} from "../config.js";

const SMSINDIAHUB_PUSH_URL = "http://cloud.smsindiahub.in/vendorsms/pushsms.aspx";
let hasLoggedConfigWarning = false;

function interpolate(template, vars = {}) {
  // Support both {otp} and ${otp} format
  return String(template || "")
    .replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""))
    .replace(/\$\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

function buildMessage(otp) {
  return interpolate(SMSINDIAHUB_MESSAGE_TEMPLATE || "Your OTP is {otp}.", { otp })
    .replace(/\s+/g, " ")
    .trim();
}

function buildUrl({ phone, message }) {
  const params = new URLSearchParams();
  params.set("APIKey", SMSINDIAHUB_API_KEY);
  params.set("msisdn", String(phone || "").trim());
  params.set("sid", SMSINDIAHUB_SENDER_ID);
  params.set("msg", message);
  params.set("fl", "0");
  params.set("gwid", "2");
  if (SMSINDIAHUB_TEMPLATE_ID) params.set("templateid", SMSINDIAHUB_TEMPLATE_ID);
  if (SMSINDIAHUB_ENTITY_ID) params.set("entityid", SMSINDIAHUB_ENTITY_ID);
  return `${SMSINDIAHUB_PUSH_URL}?${params.toString()}`;
}

function parseGatewayResponse(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return { ok: false, reason: "Empty response from SMS India Hub", parsed: null };
  }

  try {
    const parsed = JSON.parse(raw);
    const code = String(parsed?.ErrorCode ?? "").trim();
    const message = String(parsed?.ErrorMessage ?? "").trim().toLowerCase();
    const delivered = Array.isArray(parsed?.MessageData) && parsed.MessageData.length > 0;

    if (code === "000" && (message === "done" || delivered)) {
      return { ok: true, parsed };
    }

    return {
      ok: false,
      reason: parsed?.ErrorMessage || parsed?.message || raw,
      parsed,
    };
  } catch {
    if (/invalid|failed|denied|unauthori[sz]ed/i.test(raw)) {
      return { ok: false, reason: raw, parsed: null };
    }
    return { ok: true, parsed: null };
  }
}

export function validateSmsIndiaHubConfig() {
  const missing = [];
  if (!SMSINDIAHUB_API_KEY) missing.push("SMSINDIAHUB_API_KEY");
  if (!SMSINDIAHUB_SENDER_ID) missing.push("SMSINDIAHUB_SENDER_ID");
  if (!SMSINDIAHUB_MESSAGE_TEMPLATE) missing.push("SMSINDIAHUB_MESSAGE_TEMPLATE");
  if (missing.length > 0) {
    const message = `SMS India Hub config missing: ${missing.join(", ")}`;
    if (!hasLoggedConfigWarning) {
      console.warn("[SMS CONFIG]", message);
      hasLoggedConfigWarning = true;
    }
    throw new Error(message);
  }
}

export async function sendOtpSms({ phone, otp, role = "unknown", intent = "auto" }) {
  validateSmsIndiaHubConfig();
  try {
    const message = buildMessage(otp);
    const url = buildUrl({ phone, message });

    const res = await fetch(url, { method: "GET" });
    const text = await res.text();

    if (!res.ok) {
      throw new Error(`SMS India Hub failed (${res.status})`);
    }

    const parsedResponse = parseGatewayResponse(text);
    if (!parsedResponse.ok) {
      throw new Error(`SMS India Hub error: ${parsedResponse.reason}`);
    }

    console.info("[SMS]", JSON.stringify({
      role,
      intent,
      phone: String(phone || "").replace(/^(\d{2})\d+(\d{2})$/, "$1******$2"),
      status: "accepted",
    }));

    return { success: true, raw: text, parsed: parsedResponse.parsed };
  } catch (error) {
    console.error("[SMS ERROR]", error.message);
    throw error;
  }
}
