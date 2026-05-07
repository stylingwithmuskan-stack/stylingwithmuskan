import { Router } from "express";
import { body, validationResult } from "express-validator";
import SOSAlert from "../models/SOSAlert.js";
import ProviderAccount from "../models/ProviderAccount.js";
import Vendor from "../models/Vendor.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import { notify } from "../lib/notify.js";

const router = Router();

router.post(
  "/",
  body("userType").isString(),
  body("userId").isString(),
  body("message").optional().isString(),
  body("source").optional().isString(),
  body("lat").optional().isNumeric(),
  body("lng").optional().isNumeric(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { userType, userId, message, source, lat, lng } = req.body;

    let userName = "Unknown";
    let userPhone = "";
    let city = "";
    let location = { lat: Number(lat) || null, lng: Number(lng) || null };

    try {
      const typeLower = String(userType || "").toLowerCase();
      if (typeLower === "provider" || typeLower === "beautician") {
        const p = await ProviderAccount.findById(userId).lean();
        if (p) {
          userName = p.name || "Unknown Provider";
          userPhone = p.phone || "";
          city = p.city || "";
          if (!location.lat && p.currentLocation?.lat) {
            location = { lat: p.currentLocation.lat, lng: p.currentLocation.lng };
          }
        }
      } else if (typeLower === "vendor") {
        const v = await Vendor.findById(userId).lean();
        if (v) {
          userName = v.name || "Unknown Vendor";
          userPhone = v.phone || "";
          city = v.city || "";
        }
      } else {
        const u = await User.findById(userId).lean();
        if (u) {
          userName = u.name || "Unknown User";
          userPhone = u.phone || "";
          city = u.addresses?.[0]?.city || "";
        }
      }
    } catch (err) {
      console.error("[SOS] Error fetching sender details:", err.message);
    }

    const alert = await SOSAlert.create({
      userType,
      userId,
      userName,
      userPhone,
      city,
      message: message || "",
      source: source || "",
      location,
      status: "active",
    });

    try {
      // Notify Admin
      await notify({
        recipientId: "ADMIN001",
        recipientRole: "admin",
        title: "SOS Alert",
        message: `SOS Alert: ${userName} (${userType})${city ? ` in ${city}` : ""} needs help!`,
        type: "sos_alert",
        meta: { 
          alertId: alert._id?.toString(), 
          userType, 
          userId, 
          userName, 
          city 
        },
      });

      // If provider, notify their city's vendor
      if (userType === "provider" && city) {
        const vendor = await Vendor.findOne({ 
          city: { $regex: new RegExp(`^${city}$`, "i") }, 
          status: "approved" 
        }).lean();
        
        if (vendor) {
          await notify({
            recipientId: vendor._id?.toString(),
            recipientRole: "vendor",
            title: "SOS Alert",
            message: `SOS: Provider ${userName} in your city (${city}) has triggered an alert!`,
            type: "sos_alert",
            meta: { alertId: alert._id?.toString(), city, userName },
          });
        }
      }
    } catch (err) {
      console.error("[SOS] Notification failed:", err.message);
    }

    res.status(201).json({ alert });
  }
);

export default router;
