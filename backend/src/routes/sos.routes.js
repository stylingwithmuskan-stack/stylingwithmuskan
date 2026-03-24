import { Router } from "express";
import { body, validationResult } from "express-validator";
import SOSAlert from "../models/SOSAlert.js";

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
    res.status(201).json({ alert });
  }
);

export default router;
