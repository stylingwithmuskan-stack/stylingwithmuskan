import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../config.js";
const SECRET = JWT_SECRET;

export function issueRoleToken(role, subject) {
  return jwt.sign({ sub: subject, role }, SECRET, { expiresIn: "30d" });
}

export function requireRole(role) {
  return (req, res, next) => {
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
      req.auth = authed;
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}
