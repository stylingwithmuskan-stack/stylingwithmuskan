import { Router } from "express";
import { body, validationResult } from "express-validator";
import SOSAlert from "../models/SOSAlert.js";
import ProviderAccount from "../models/ProviderAccount.js";
import Vendor from "../models/Vendor.js";
import mongoose from "mongoose";
import { notify } from "../lib/notify.js";

const router = Router();

router.post(
  "/",
  body("userType").isString(),
  body("userId").isString(),
  body("message").optional().isString(),
  body("source").optional().isString(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const alert = await SOSAlert.create({
      userType: req.body.userType,
      userId: req.body.userId,
      message: req.body.message || "",
      source: req.body.source || "",
      status: "active",
    });
    try {
      await notify({
        recipientId: "ADMIN001",
        recipientRole: "admin",
        title: "SOS Alert",
        message: `SOS received from ${req.body.userType}.`,
        type: "sos_alert",
        meta: { alertId: alert._id?.toString?.(), userType: req.body.userType, userId: req.body.userId },
      });
      if (String(req.body.userType || "").toLowerCase() === "provider") {
        let provider = null;
        const rawId = String(req.body.userId || "");
        if (mongoose.isValidObjectId(rawId)) {
          provider = await ProviderAccount.findById(rawId).lean();
        } else if (/^\d{10}$/.test(rawId)) {
          provider = await ProviderAccount.findOne({ phone: rawId }).lean();
        }
        const city = provider?.city || "";
        if (city) {
          const vendor = await Vendor.findOne({ city: { $regex: new RegExp(`^${city}$`, "i") }, status: "approved" }).lean();
          if (vendor) {
            await notify({
              recipientId: vendor._id?.toString(),
              recipientRole: "vendor",
              title: "SOS Alert",
              message: `SOS received from a provider in ${city}.`,
              type: "sos_alert",
              meta: { alertId: alert._id?.toString?.(), city },
            });
          }
        }
      }
    } catch {}
    res.status(201).json({ alert });
  }
);

export default router;
