import admin from "firebase-admin";
import apn from "apn";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Notification from "../models/Notification.js";
import PushDevice from "../models/PushDevice.js";
import { BookingSettings } from "../models/Settings.js";
import { OfficeSettings } from "../models/Content.js";
import {
  PUSH_DEFAULT_CLICK_BASE_URL,
  PUSH_BATCH_SIZE,
  PUSH_RETRY_LIMIT,
} from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Firebase init (singleton)
// ---------------------------------------------------------------------------

export let pushEnabled = false;

(function initFirebase() {
  const fileName = "stylingwithmuskan-635f3-firebase-adminsdk-fbsvc-1124a7e333.json";
  const possiblePaths = [
    path.resolve(__dirname, "../config", fileName),
    path.resolve(process.cwd(), "src/config", fileName),
    path.resolve(process.cwd(), "backend/src/config", fileName),
    path.join("/root/stylingwithmuskan/backend/src/config", fileName)
  ];

  let serviceAccountPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      serviceAccountPath = p;
      break;
    }
  }

  if (!serviceAccountPath) {
    console.error(`[push] ❌ CRITICAL: Service account file NOT found in any search paths!`);
    console.error(`[push] Paths tried: ${JSON.stringify(possiblePaths, null, 2)}`);
    pushEnabled = false;
    return;
  }

  console.log(`[push] 🏁 initFirebase found config at: ${serviceAccountPath}`);

  try {
    if (admin.apps.length === 0) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log(`[push] ✅ Firebase Admin initialized successfully for project: ${serviceAccount.project_id}`);
      pushEnabled = true;
    } else {
      pushEnabled = true;
    }
  } catch (err) {
    console.error("[push] ❌ Firebase Admin initialization error:", err.message);
    pushEnabled = false;
  }
})();

export let apnProvider = null;
export let voipApnProvider = null;

(function initApn() {
  if (process.env.APN_KEY && process.env.APN_KEY_ID && process.env.APN_TEAM_ID) {
    try {
      apnProvider = new apn.Provider({
        token: {
          key: process.env.APN_KEY.replace(/\\n/g, '\n'),
          keyId: process.env.APN_KEY_ID,
          teamId: process.env.APN_TEAM_ID
        },
        production: process.env.NODE_ENV === "production"
      });
      console.log(`[push] ✅ APN Provider initialized successfully`);
    } catch (e) {
      console.error("[push] ❌ APN init error:", e);
    }
  }

  try {
    const certPath = path.resolve(__dirname, "../config/Certificates.p12");
    if (fs.existsSync(certPath)) {
      voipApnProvider = new apn.Provider({
        pfx: certPath,
        passphrase: process.env.VOIP_CERT_PASSWORD || "", // empty or from env
        production: process.env.NODE_ENV === "production"
      });
      console.log(`[push] ✅ VoIP APN Provider initialized successfully with Certificates.p12`);
    } else {
      console.warn(`[push] ⚠️ VoIP certificate not found at ${certPath}`);
    }
  } catch (e) {
    console.error("[push] ❌ VoIP APN init error:", e);
  }
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withinWindow(now, startTime, endTime) {
  const [startH, startM] = String(startTime || "07:00").split(":").map(Number);
  const [endH, endM] = String(endTime || "22:00").split(":").map(Number);
  if (Number.isNaN(startH) || Number.isNaN(endH)) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = startH * 60 + (startM || 0);
  const end = endH * 60 + (endM || 0);
  if (start === end) return true;
  if (end > start) return mins >= start && mins <= end;
  return mins >= start || mins <= end;
}

export async function isWithinProviderPushWindow() {
  try {
    const office = await OfficeSettings.findOne().lean();
    const bookingSettings = await BookingSettings.findOne().lean();
    return withinWindow(
      new Date(),
      bookingSettings?.providerNotificationStartTime || office?.startTime || "07:00",
      bookingSettings?.providerNotificationEndTime || office?.endTime || "22:00"
    );
  } catch {
    return true;
  }
}

function normalizeLink(link = "") {
  const safe = String(link || "").trim();
  if (!safe) return `${PUSH_DEFAULT_CLICK_BASE_URL.replace(/\/$/, "")}/notifications`;
  if (/^https?:\/\//i.test(safe)) return safe;
  return `${PUSH_DEFAULT_CLICK_BASE_URL.replace(/\/$/, "")}${safe.startsWith("/") ? safe : `/${safe}`}`;
}

export function buildNotificationLink({ recipientRole, type, meta = {} }) {
  const bookingId = meta?.bookingId ? String(meta.bookingId) : "";
  const enquiryId = meta?.enquiryId ? String(meta.enquiryId) : "";

  if (recipientRole === "user") {
    if (type.startsWith("payment_")) return "/payment";
    if (type.startsWith("custom_") && enquiryId) return `/bookings?enquiry=${enquiryId}`;
    if (bookingId) return `/bookings`;
    return "/notifications";
  }
  if (recipientRole === "provider") {
    if (type === "provider_admin_approved" || type === "provider_vendor_approved" || type === "provider_rejected") return "/provider/profile";
    if (type === "leave_approved" || type === "leave_rejected") return "/provider/profile";
    if (type === "zone_added") return "/provider/all-zones";
    if (bookingId) return `/provider/bookings`;
    return "/provider/notifications";
  }
  if (recipientRole === "vendor") {
    if (type === "sos_alert") return "/vender/sos";
    if (type.startsWith("custom_")) return "/vender/bookings";
    if (bookingId) return "/vender/bookings";
    return "/vender/notifications";
  }
  if (recipientRole === "admin") {
    if (type === "sos_alert") return "/admin/sos";
    if (type === "leave_requested") return "/admin/sp";
    if (type.includes("vendor")) return "/admin/vendors";
    if (type.includes("provider")) return "/admin/sp";
    if (bookingId) return "/admin/bookings";
    return "/admin/notifications";
  }
  return "/notifications";
}

async function deactivateToken(fcmToken, error) {
  await PushDevice.updateOne(
    { fcmToken },
    { $set: { isActive: false, lastError: String(error) } }
  );
}

// ---------------------------------------------------------------------------
// buildFCMPayload
// ---------------------------------------------------------------------------

export function buildFCMPayload(notification, platform = "all") {
  const title = String(notification.title || "").slice(0, 100);
  const body = String(notification.message || "").slice(0, 200);
  const link = normalizeLink(notification.link);
  const sound = notification.sound || "default";
  const imageUrl = notification.image || null;
  const isUrgent = ["ringtone", "emergency", "alert", "success"].includes(sound);

  return {
    notification: {
      title,
      body,
      ...(imageUrl ? { imageUrl } : {})
    },
    android: {
      priority: "high",
      notification: {
        sound: sound === "default" ? "default" : sound,
        channelId: "high_priority_notifications",
        icon: "notification_icon",
        color: "#9333ea",
        priority: "max",
        visibility: "public",
        notification_priority: "PRIORITY_HIGH",
        ...(imageUrl ? { imageUrl } : {})
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "ringtone2.wav",
          badge: 1,
          critical: isUrgent,
          "mutable-content": imageUrl ? 1 : 0,
        },
      },
      fcm_options: {
        ...(imageUrl ? { image: imageUrl } : {})
      },
      headers: {
        "apns-priority": "10",
      }
    },
    webpush: {
      notification: {
        icon: "/logo.png",
        badge: "/logo.png",
        image: imageUrl || undefined,
        vibrate: isUrgent ? [300, 100, 300, 100, 300, 100, 300] : [200, 100, 200],
        requireInteraction: isUrgent,
        silent: false,
      },
      fcmOptions: {
        link: String(link),
      },
      headers: {
        Urgency: isUrgent ? "high" : "normal",
      },
    },
    data: {
      notificationId: String(notification._id),
      link: String(link),
      type: String(notification.type),
      role: String(notification.recipientRole),
      sound: platform === "ios" ? "ringtone2.wav" : String(sound),
      image: imageUrl || "",
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    },
  };
}

// ---------------------------------------------------------------------------
// sendPushForNotification
// ---------------------------------------------------------------------------

export async function sendPushForNotification(notification) {
  if (!pushEnabled) {
    await Notification.updateOne(
      { _id: notification._id },
      { $set: { "delivery.push.status": "disabled" } }
    );
    return { sent: 0, failed: 0 };
  }

  if ((notification.delivery?.push?.failureCount ?? 0) >= PUSH_RETRY_LIMIT) {
    await Notification.updateOne(
      { _id: notification._id },
      { $set: { "delivery.push.status": "failed" } }
    );
    return { sent: 0, failed: 0 };
  }

  if (notification.recipientRole === "provider") {
    const inWindow = await isWithinProviderPushWindow();
    if (!inWindow) {
      await queuePushForNotification(notification, "Provider quiet hours");
      return { sent: 0, failed: 0 };
    }
  }

  const devices = await PushDevice.find({
    recipientId: notification.recipientId,
    isActive: true,
    "preferences.enabled": true,
  }).lean();

  if (!devices.length) {
    console.warn(`[push] No active push devices found for recipient: ${notification.recipientId}`);
    await Notification.updateOne(
      { _id: notification._id },
      {
        $set: {
          "delivery.push.status": "failed",
          "delivery.push.lastAttemptAt": new Date(),
          "delivery.push.lastError": "No active devices",
        },
        $inc: { "delivery.push.failureCount": 1 },
      }
    );
    return { sent: 0, failed: 0 };
  }

  console.log(`[push] Found ${devices.length} devices for recipient ${notification.recipientId}. Sending FCM...`);

  // --- Admin Broadcast VoIP Ring Fallback ---
  if (notification.type === "marketing_campaign") {
    const voipDevices = devices.filter(d => (d.platform || "").toLowerCase() === "ios" && d.voipToken);
    for (const d of voipDevices) {
      sendBroadcastVoipPush(
        d.voipToken,
        notification.meta?.broadcastId || notification._id,
        notification.title,
        notification.message,
        d.recipientRole
      ).catch(() => { }); // Fire and forget
    }
  }
  // ------------------------------------------

  const iosTokens = [...new Set(devices.filter(d => (d.platform || "").toLowerCase() === "ios").map((d) => d.fcmToken))];
  const otherTokens = [...new Set(devices.filter(d => (d.platform || "").toLowerCase() !== "ios").map((d) => d.fcmToken))];

  const sendBatch = async (tokens, payload) => {
    let sent = 0;
    let failed = 0;
    for (let i = 0; i < tokens.length; i += PUSH_BATCH_SIZE) {
      const batch = tokens.slice(i, i + PUSH_BATCH_SIZE);
      try {
        const response = await admin.messaging().sendEachForMulticast({
          ...payload,
          tokens: batch,
        });

        console.log(`[push] FCM Batch response: success=${response.successCount}, failure=${response.failureCount}`);

        for (let j = 0; j < response.responses.length; j++) {
          const res = response.responses[j];
          if (res.success) {
            sent++;
          } else {
            failed++;
            const code = res.error?.code;
            const message = res.error?.message;
            const device = devices.find(d => d.fcmToken === batch[j]);
            console.error(`[push] Token ${batch[j].slice(-6)} failed. Platform: ${device?.platform || 'unknown'}, Role: ${device?.recipientRole || 'unknown'}, Code: ${code}, Message: ${message}`);
            if (
              code === "messaging/registration-token-not-registered" ||
              code === "messaging/invalid-registration-token"
            ) {
              await deactivateToken(batch[j], code);
            }
          }
        }
      } catch (err) {
        failed += batch.length;
        console.error("[push] sendEachForMulticast error:", err);
      }
    }
    return { sent, failed };
  };

  let totalSent = 0;
  let totalFailed = 0;

  if (iosTokens.length > 0) {
    if (apnProvider) {
      console.log(`[push] Sending APN directly for ${iosTokens.length} iOS tokens...`);
      const note = new apn.Notification();
      note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
      note.badge = 1;
      note.sound = "order_ringtone.caf";
      note.pushType = "alert"; // Use 'alert' to show banner and play custom sound
      note.alert = {
        title: String(notification.title || "").slice(0, 100),
        body: String(notification.message || "").slice(0, 200)
      };
      note.payload = {
        notificationId: String(notification._id),
        link: String(normalizeLink(notification.link)),
        type: String(notification.type),
        role: String(notification.recipientRole)
      };

      // Set correct Bundle ID (Topic) based on user role
      const role = String(notification.recipientRole);
      if (role === "provider") {
        note.topic = process.env.APN_TOPIC_PROVIDER || "com.company.swmprovider";
      } else if (role === "vendor") {
        note.topic = process.env.APN_TOPIC_VENDOR || "com.company.swmvendor";
      } else {
        note.topic = process.env.APN_TOPIC || "com.stylingwithmuskan";
      }

      try {
        const result = await apnProvider.send(note, iosTokens);
        console.log(`[push] APN Batch response: success=${result.sent.length}, failure=${result.failed.length}`);
        totalSent += result.sent.length;
        totalFailed += result.failed.length;

        // Handle failed tokens (e.g. deactivate if Unregistered)
        result.failed.forEach(failure => {
          if (failure.status === "410" || failure.response?.reason === "Unregistered") {
            deactivateToken(failure.device, failure.response?.reason).catch(console.error);
          }
        });
      } catch (apnError) {
        console.error("[push] APN send error:", apnError);
        totalFailed += iosTokens.length;
      }
    } else {
      const iosPayload = buildFCMPayload(notification, "ios");
      iosPayload.apns.payload.aps.sound = "order_ringtone.caf"; // Set custom sound for FCM APNS fallback
      const res = await sendBatch(iosTokens, iosPayload);
      totalSent += res.sent;
      totalFailed += res.failed;
    }
  }

  if (otherTokens.length > 0) {
    const otherPayload = buildFCMPayload(notification, "android");
    const res = await sendBatch(otherTokens, otherPayload);
    totalSent += res.sent;
    totalFailed += res.failed;
  }

  const now = new Date();
  const statusUpdate = {
    "delivery.push.status": totalSent > 0 ? "sent" : "failed",
    "delivery.push.lastAttemptAt": now,
    "delivery.push.failureCount": (notification.delivery?.push?.failureCount ?? 0) + totalFailed,
  };
  if (totalSent > 0) {
    statusUpdate["delivery.push.sentAt"] = now;
  }
  if (totalSent === 0 && totalFailed > 0) {
    statusUpdate["delivery.push.lastError"] = "All tokens failed";
  }

  await Notification.updateOne({ _id: notification._id }, { $set: statusUpdate });

  return { sent: totalSent, failed: totalFailed };
}

// ---------------------------------------------------------------------------
// queuePushForNotification
// ---------------------------------------------------------------------------

export async function queuePushForNotification(notification, reason = "") {
  await Notification.updateOne(
    { _id: notification._id },
    {
      $set: {
        "delivery.push.status": "queued",
        "delivery.push.lastError": reason,
      },
    }
  );
}

// ---------------------------------------------------------------------------
// processQueuedPushNotifications
// ---------------------------------------------------------------------------

export async function processQueuedPushNotifications() {
  if (!pushEnabled) return;
  const inWindow = await isWithinProviderPushWindow();
  if (!inWindow) return;

  const queued = await Notification.find({
    "delivery.push.status": "queued",
    recipientRole: "provider",
  })
    .limit(50)
    .lean();

  for (const notification of queued) {
    await sendPushForNotification(notification);
  }
}

// ---------------------------------------------------------------------------
// enforceDeviceLimit
// ---------------------------------------------------------------------------

export async function enforceDeviceLimit(recipientId, recipientRole) {
  const devices = await PushDevice.find(
    { recipientId, recipientRole, isActive: true },
    { _id: 1, lastSeenAt: 1 }
  )
    .sort({ lastSeenAt: 1 })
    .lean();

  if (devices.length <= 10) return;

  const excess = devices.length - 10;
  const oldestIds = devices.slice(0, excess).map((d) => d._id);

  await PushDevice.updateMany(
    { _id: { $in: oldestIds } },
    { $set: { isActive: false } }
  );
}

// ---------------------------------------------------------------------------
// isDuplicatePush
// ---------------------------------------------------------------------------

export async function isDuplicatePush(recipientId, dedupeKey, windowMs) {
  const doc = await Notification.findOne({
    recipientId,
    "meta.dedupeKey": dedupeKey,
    createdAt: { $gte: new Date(Date.now() - windowMs) },
  }).lean();
  return doc !== null;
}

// ---------------------------------------------------------------------------
// sendVoipPush
// ---------------------------------------------------------------------------

export async function sendVoipPush(voipToken, bookingId, customerName, role = "provider") {
  if (!voipApnProvider) {
    console.error("[push] ❌ voipApnProvider is not initialized.");
    return false;
  }
  if (!voipToken) {
    console.error("[push] ❌ voipToken is missing.");
    return false;
  }

  const notification = new apn.Notification();
  // Ensure the topic has .voip suffix for VoIP pushes
  const baseTopic = role === "provider"
    ? (process.env.APN_TOPIC_PROVIDER || "com.company.swmprovider")
    : (process.env.APN_TOPIC || "com.stylingwithmuskan");
  notification.topic = `${baseTopic}.voip`;
  notification.pushType = "voip";
  notification.priority = 10;
  notification.expiry = Math.floor(Date.now() / 1000) + 3600;

  notification.payload = {
    "content_available": true,
    data: {
      id: String(bookingId),
      nameCaller: "New Booking Alert!",
      handle: `${customerName || "Customer"} requested a service`,
      type: 0,
      room_id: `room_${bookingId}`,
      extra: {
        bookingId: String(bookingId),
        customerName: customerName || ""
      }
    }
  };

  try {
    const result = await voipApnProvider.send(notification, voipToken);
    console.log(`[push] VoIP Push sent. Success: ${result.sent.length}, Failed: ${result.failed.length}`);
    if (result.failed.length > 0) {
      console.error(`[push] VoIP Push failure details:`, JSON.stringify(result.failed, null, 2));
    }
    return result.sent.length > 0;
  } catch (error) {
    console.error("[push] ❌ VoIP Push error:", error);
    return false;
  }
}

export async function sendBroadcastVoipPush(voipToken, broadcastId, title, message, role = "provider") {
  if (!voipApnProvider) {
    console.error("[push] ❌ voipApnProvider is not initialized.");
    return false;
  }
  if (!voipToken) {
    console.error("[push] ❌ voipToken is missing.");
    return false;
  }

  const notification = new apn.Notification();
  const baseTopic = role === "provider"
    ? (process.env.APN_TOPIC_PROVIDER || "com.company.swmprovider")
    : role === "vendor"
      ? (process.env.APN_TOPIC_VENDOR || "com.company.swmvendor")
      : (process.env.APN_TOPIC || "com.stylingwithmuskan");
  notification.topic = `${baseTopic}.voip`;
  notification.pushType = "voip";
  notification.priority = 10;
  notification.expiry = Math.floor(Date.now() / 1000) + 3600;

  notification.payload = {
    "content_available": true,
    data: {
      id: String(broadcastId),
      nameCaller: String(title || "Admin Alert").slice(0, 50),
      handle: String(message || "New message").slice(0, 100),
      type: 0,
      room_id: `room_${broadcastId}`,
      extra: {
        broadcastId: String(broadcastId)
      }
    }
  };

  try {
    const result = await voipApnProvider.send(notification, voipToken);
    console.log(`[push] Broadcast VoIP Push sent. Success: ${result.sent.length}, Failed: ${result.failed.length}`);
    if (result.failed.length > 0) {
      console.error(`[push] Broadcast VoIP Push failure details:`, JSON.stringify(result.failed, null, 2));
    }
    return result.sent.length > 0;
  } catch (error) {
    console.error("[push] ❌ Broadcast VoIP Push error:", error);
    return false;
  }
}

