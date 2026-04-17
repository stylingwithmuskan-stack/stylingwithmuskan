import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../config.js";
const SECRET = JWT_SECRET;

export function issueRoleToken(role, subject) {
  return jwt.sign({ sub: subject, role }, SECRET, { expiresIn: "30d" });
}

export function requireRole(role) {
  return async (req, res, next) => {
    try {
      const cookies = req.cookies || {};
      const headerToken =
        req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.split(" ")[1]
          : null;
      const preferred =
        role === "provider"
          ? cookies.providerToken
          : role === "admin"
          ? cookies.adminToken
          : role === "vendor"
          ? cookies.vendorToken
          : null;
      const candidates = [];
      if (preferred) candidates.push(preferred);
      if (headerToken) candidates.push(headerToken);
      const order = ["adminToken", "vendorToken", "providerToken", "token"];
      for (const k of order) {
        const t = cookies[k];
        if (t && t !== preferred) candidates.push(t);
      }
      let authed = null;
      for (const t of candidates) {
        try {
          const p = jwt.verify(t, SECRET);
          if (p.role === role) {
            authed = p;
            break;
          }
        } catch {}
      }
      if (!authed) return res.status(401).json({ error: "Unauthorized" });

      // If the role is provider, check if they are blocked in DB
      if (authed.role === "provider") {
        try {
          const ProviderAccount = (await import("../models/ProviderAccount.js")).default;
          const acc = await ProviderAccount.findById(authed.sub).select("approvalStatus").lean();
          if (!acc || acc.approvalStatus !== "approved") {
            return res.status(403).json({ error: "Account is blocked or not approved", code: "ACCOUNT_RESTRICTED" });
          }
        } catch (e) {
          console.error("[Middleware] Provider status check failed:", e.message);
        }
      }

      req.auth = authed;
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}

export function requireAnyRole(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      const cookies = req.cookies || {};
      const headerToken =
        req.headers.authorization?.startsWith("Bearer ")
          ? req.headers.authorization.split(" ")[1]
          : null;
      
      const candidates = [];
      if (headerToken) candidates.push(headerToken);
      
      const order = ["adminToken", "vendorToken", "providerToken", "token"];
      for (const k of order) {
        const t = cookies[k];
        if (t) candidates.push(t);
      }
      
      let authed = null;
      for (const t of candidates) {
        try {
          const p = jwt.verify(t, SECRET);
          if (allowedRoles.length === 0 || allowedRoles.includes(p.role)) {
            authed = p;
            break;
          }
        } catch {}
      }
      
      if (!authed) return res.status(401).json({ error: "Unauthorized" });

      // If the role is provider, check if they are blocked in DB
      if (authed.role === "provider") {
        try {
          const ProviderAccount = (await import("../models/ProviderAccount.js")).default;
          const acc = await ProviderAccount.findById(authed.sub).select("approvalStatus").lean();
          if (!acc || acc.approvalStatus !== "approved") {
            return res.status(403).json({ error: "Account is blocked or not approved", code: "ACCOUNT_RESTRICTED" });
          }
        } catch (e) {
          console.error("[Middleware] Provider status check failed:", e.message);
        }
      }

      req.auth = authed;
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}
