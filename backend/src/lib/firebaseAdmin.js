import {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
} from "../config.js";

let adminAppPromise = null;

function hasFirebaseConfig() {
  return Boolean(
    FIREBASE_PROJECT_ID &&
    FIREBASE_CLIENT_EMAIL &&
    FIREBASE_PRIVATE_KEY
  );
}

async function getAdminApp() {
  if (!hasFirebaseConfig()) return null;

  if (!adminAppPromise) {
    adminAppPromise = (async () => {
      const adminModule = await import("firebase-admin");
      const admin = adminModule.default || adminModule;

      const existing = admin.getApps?.()?.[0] || admin.apps?.[0];
      if (existing) return existing;

      const credential = admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      });

      return admin.initializeApp({ credential });
    })().catch((error) => {
      adminAppPromise = null;
      throw error;
    });
  }

  return adminAppPromise;
}

export async function sendFirebasePush({
  tokens = [],
  title = "",
  body = "",
  data = {},
  icon = "",
}) {
  const uniqueTokens = Array.from(new Set((tokens || []).filter(Boolean)));

  if (uniqueTokens.length === 0) {
    return { successCount: 0, failureCount: 0, responses: [] };
  }

  const app = await getAdminApp();
  if (!app) {
    return {
      successCount: 0,
      failureCount: uniqueTokens.length,
      responses: uniqueTokens.map(() => ({
        success: false,
        error: new Error("Firebase admin not configured"),
      })),
    };
  }

  const adminModule = await import("firebase-admin");
  const admin = adminModule.default || adminModule;

  const message = {
    tokens: uniqueTokens,
    notification: {
      title,
      body,
      ...(icon ? { imageUrl: icon } : {}),
    },
    webpush: {
      notification: {
        title,
        body,
        ...(icon ? { icon } : {}),
      },
      fcmOptions: {
        link: data?.link || "/notifications",
      },
    },
    data: Object.entries(data || {}).reduce((acc, [key, value]) => {
      acc[key] = typeof value === "string" ? value : JSON.stringify(value ?? "");
      return acc;
    }, {}),
  };

  return admin.messaging(app).sendEachForMulticast(message);
}

export function isFirebaseConfigured() {
  return hasFirebaseConfig();
}
