// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";
// import {
//   FIREBASE_PROJECT_ID,
//   FIREBASE_CLIENT_EMAIL,
//   FIREBASE_PRIVATE_KEY,
// } from "../config.js";

// let adminAppPromise = null;

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// let cachedServiceAccount = null;

// function loadServiceAccountFromFile() {
//   if (cachedServiceAccount) return cachedServiceAccount;

//   const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "";
//   const configDir = path.resolve(__dirname, "../config");
//   const repoRoot = path.resolve(__dirname, "../..");
//   const candidates = [
//     explicitPath,
//     path.join(repoRoot, "config.json"),
//     path.join(repoRoot, "firebase-config.json"),
//     path.join(configDir, "config.json"),
//     path.join(configDir, "firebase-service-account.json"),
//   ].filter(Boolean);

//   try {
//     if (fs.existsSync(configDir)) {
//       const match = fs.readdirSync(configDir).find((name) => name.includes("firebase-adminsdk") && name.endsWith(".json"));
//       if (match) candidates.push(path.join(configDir, match));
//     }
//   } catch {}

//   for (const candidate of candidates) {
//     try {
//       if (!candidate || !fs.existsSync(candidate)) continue;
//       const raw = fs.readFileSync(candidate, "utf8");
//       const parsed = JSON.parse(raw);
//       if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
//         cachedServiceAccount = {
//           projectId: parsed.project_id,
//           clientEmail: parsed.client_email,
//           privateKey: parsed.private_key,
//         };
//         return cachedServiceAccount;
//       }
//     } catch {}
//   }

//   return null;
// }

// function hasFirebaseConfig() {
//   const fileConfig = loadServiceAccountFromFile();
//   if (fileConfig) return true;
//   return Boolean(FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY);
// }

// async function getAdminApp() {
//   if (!hasFirebaseConfig()) return null;
//   if (!adminAppPromise) {
//     adminAppPromise = (async () => {
//       const adminModule = await import("firebase-admin");
//       const admin = adminModule.default || adminModule;
//       const existing = admin.getApps?.()?.[0] || admin.apps?.[0];
//       if (existing) return existing;
//       const fromFile = loadServiceAccountFromFile();
//       const credentialSource = fromFile || {
//         projectId: FIREBASE_PROJECT_ID,
//         clientEmail: FIREBASE_CLIENT_EMAIL,
//         privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//       };
//       const credential = admin.credential.cert({
//         projectId: credentialSource.projectId,
//         clientEmail: credentialSource.clientEmail,
//         privateKey: credentialSource.privateKey,
//       });
//       return admin.initializeApp({ credential });
//     })().catch((error) => {
//       adminAppPromise = null;
//       throw error;
//     });
//   }
//   return adminAppPromise;
// }

// export async function sendFirebasePush({ tokens = [], title = "", body = "", data = {}, icon = "" }) {
//   const uniqueTokens = Array.from(new Set((tokens || []).filter(Boolean)));
//   if (uniqueTokens.length === 0) {
//     return { successCount: 0, failureCount: 0, responses: [] };
//   }
//   const app = await getAdminApp();
//   if (!app) {
//     return {
//       successCount: 0,
//       failureCount: uniqueTokens.length,
//       responses: uniqueTokens.map(() => ({ success: false, error: new Error("Firebase admin not configured") })),
//     };
//   }

//   const adminModule = await import("firebase-admin");
//   const admin = adminModule.default || adminModule;
//   const message = {
//     tokens: uniqueTokens,
//     notification: {
//       title,
//       body,
//       ...(icon ? { imageUrl: icon } : {}),
//     },
//     webpush: {
//       notification: {
//         title,
//         body,
//         ...(icon ? { icon } : {}),
//       },
//       fcmOptions: {
//         link: data?.link || "/notifications",
//       },
//     },
//     data: Object.entries(data || {}).reduce((acc, [key, value]) => {
//       acc[key] = typeof value === "string" ? value : JSON.stringify(value ?? "");
//       return acc;
//     }, {}),
//   };

//   return admin.messaging(app).sendEachForMulticast(message);
// }

// export function isFirebaseConfigured() {
//   return hasFirebaseConfig();
// }


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