import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { JWT_SECRET } from "../config.js";

export async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/**
 * Flexible authentication that supports all roles
 * Populates req.auth with the decoded payload and req.user if it's a customer
 */
export async function flexibleAuth(req, res, next) {
  try {
    const cookies = req.cookies || {};
    const headerToken = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;

    const candidates = [
      headerToken,
      cookies.token,
      cookies.providerToken,
      cookies.adminToken,
      cookies.vendorToken,
    ].filter(Boolean);

    let decoded = null;
    for (const t of candidates) {
      try {
        decoded = jwt.verify(t, JWT_SECRET);
        if (decoded) break;
      } catch {}
    }

    if (!decoded) {
      console.warn(`[Auth] No valid token found for ${req.method} ${req.path}. Candidates: ${candidates.length}`);
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    console.log(`[Auth] Success for ${req.method} ${req.path}. Role: ${decoded.role || 'user'}`);
    
    req.auth = decoded;
    // If it's a customer token (legacy or role-based), try to populate req.user
    if (!decoded.role || decoded.role === "user") {
      const user = await User.findById(decoded.sub);
      if (user) req.user = user;
    }
    
    next();
  } catch (err) {
    console.error(`[Auth] Error in flexibleAuth: ${err.message}`);
    return res.status(401).json({ error: "Unauthorized" });
  }
}

export function issueToken(userId) {
  const token = jwt.sign(
    { sub: userId.toString() },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
  return token;
}
