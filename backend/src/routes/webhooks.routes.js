import { Router } from "express";
import crypto from "crypto";
import Booking from "../models/Booking.js";
import BookingLog from "../models/BookingLog.js";
import User from "../models/User.js";
import { notify } from "../lib/notify.js";
import { RAZORPAY_WEBHOOK_SECRET } from "../config.js";

const router = Router();

/**
 * Razorpay Webhook Handler
 * Handles refund status updates from Razorpay
 * 
 * IMPORTANT: This route must be registered BEFORE express.json() middleware
 * because we need raw body for signature verification
 */
router.post("/razorpay", async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers["x-razorpay-signature"];
    
    if (!signature || !RAZORPAY_WEBHOOK_SECRET) {
      console.error("[Webhook] Missing signature or webhook secret");
      return res.status(400).json({ error: "Invalid webhook" });
    }
    
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(req.rawBody || JSON.stringify(req.body))
      .digest("hex");
    
    if (expectedSignature !== signature) {
      console.error("[Webhook] Signature verification failed");
      return res.status(400).json({ error: "Invalid signature" });
    }
    
    const event = req.body.event;
    const payload = req.body.payload;
    
    console.log(`[Webhook] Received event: ${event}`);
    
    // Handle refund events
    if (event === "refund.processed" || event === "refund.failed") {
      const refund = payload.refund?.entity || payload.refund;
      const paymentId = refund.payment_id;
      const refundId = refund.id;
      const refundAmount = refund.amount / 100; // Convert paise to rupees
      const refundStatus = event === "refund.processed" ? "processed" : "failed";
      
      console.log(`[Webhook] Refund ${refundStatus}: refundId=${refundId}, paymentId=${paymentId}, amount=₹${refundAmount}`);
      
      // Find booking by payment ID
      const booking = await Booking.findOne({
        $or: [
          { paymentId: paymentId },
          { "paymentOrder.id": paymentId },
          { "paymentSources.paymentId": paymentId }
        ]
      });
      
      if (!booking) {
        console.error(`[Webhook] Booking not found for paymentId=${paymentId}`);
        return res.status(404).json({ error: "Booking not found" });
      }
      
      // Update refund status in booking
      const refundIndex = booking.refunds.findIndex(r => 
        r.refundId === refundId || 
        (r.status === "processing" && r.source === "razorpay")
      );
      
      if (refundIndex !== -1) {
        booking.refunds[refundIndex].status = refundStatus;
        booking.refunds[refundIndex].refundId = refundId;
        booking.refunds[refundIndex].refundedAt = new Date();
        
        if (refundStatus === "failed") {
          booking.refunds[refundIndex].error = refund.error_description || "Refund failed";
        }
      } else {
        // Refund not found in array, add it
        booking.refunds.push({
          source: "razorpay",
          amount: refundAmount,
          status: refundStatus,
          refundId: refundId,
          refundedAt: new Date(),
          error: refundStatus === "failed" ? (refund.error_description || "Refund failed") : ""
        });
      }
      
      // Update overall refund status
      const allProcessed = booking.refunds.every(r => r.status === "processed");
      const anyFailed = booking.refunds.some(r => r.status === "failed");
      const anyProcessing = booking.refunds.some(r => r.status === "processing");
      
      if (allProcessed) {
        booking.refundStatus = "processed";
      } else if (anyFailed && !anyProcessing) {
        booking.refundStatus = "failed";
      } else if (anyProcessing) {
        booking.refundStatus = "processing";
      } else {
        booking.refundStatus = "partial";
      }
      
      await booking.save();
      
      // Log the webhook event
      await BookingLog.create({
        action: "booking:refund-webhook",
        userId: booking.customerId,
        bookingId: booking._id.toString(),
        meta: {
          event,
          refundId,
          refundAmount,
          refundStatus,
          paymentId
        }
      });
      
      // Notify user about refund status
      if (refundStatus === "processed") {
        const user = await User.findById(booking.customerId);
        if (user) {
          await notify({
            recipientId: user._id.toString(),
            recipientRole: "user",
            type: "refund_processed",
            meta: {
              bookingId: booking._id.toString(),
              amount: refundAmount,
              refundAmount,
              refundId
            }
          });
        }
      } else if (refundStatus === "failed") {
        const user = await User.findById(booking.customerId);
        if (user) {
          await notify({
            recipientId: user._id.toString(),
            recipientRole: "user",
            type: "refund_failed",
            meta: {
              bookingId: booking._id.toString(),
              amount: refundAmount,
              refundAmount,
              refundId
            }
          });
        }
      }
      
      console.log(`[Webhook] Booking updated: bookingId=${booking._id}, refundStatus=${booking.refundStatus}`);
    }
    
    res.json({ success: true });
    
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
