import Booking from "../models/Booking.js";
import { slotLabelToLocalDateTime } from "./slots.js";
import { BOOKING_AUTO_CANCEL_THRESHOLD_MINUTES } from "../config.js";
import { processSmartRefund } from "./refund.service.js";
import { notify } from "./notify.js";
import { getIO } from "../startup/socket.js";
import BookingLog from "../models/BookingLog.js";

/**
 * Check if a booking should be auto-expired
 * @param {Object} booking - Booking document
 * @param {Date} now - Current time
 * @returns {Object} { shouldExpire: boolean, reason: string, diffMinutes: number }
 */
export function shouldAutoExpireBooking(booking, now) {
  // Only auto-expire bookings that are escalated (vendor or admin) and still pending
  if (booking.status !== "pending") {
    return { shouldExpire: false, reason: "not_pending", diffMinutes: null };
  }

  // Must be escalated (either vendor or admin)
  if (!booking.vendorEscalated && !booking.adminEscalated) {
    return { shouldExpire: false, reason: "not_escalated", diffMinutes: null };
  }

  // Must have a valid slot time
  const slotTime = slotLabelToLocalDateTime(booking.slot?.date, booking.slot?.time);
  if (!slotTime) {
    return { shouldExpire: false, reason: "invalid_slot", diffMinutes: null };
  }

  // Calculate time difference
  const diffMs = slotTime.getTime() - now.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  // Auto-expire if within threshold (default 60 minutes)
  const threshold = Math.max(Number(BOOKING_AUTO_CANCEL_THRESHOLD_MINUTES || 60), 0);
  
  if (diffMinutes < threshold && diffMinutes > 0) {
    return { 
      shouldExpire: true, 
      reason: `slot_time_within_${threshold}_minutes`, 
      diffMinutes: Math.round(diffMinutes) 
    };
  }

  // Also expire if slot time has already passed
  if (diffMinutes <= 0) {
    return { 
      shouldExpire: true, 
      reason: "slot_time_passed", 
      diffMinutes: Math.round(diffMinutes) 
    };
  }

  return { shouldExpire: false, reason: "not_within_threshold", diffMinutes: Math.round(diffMinutes) };
}

/**
 * Auto-expire a single booking
 * @param {Object} booking - Booking document (mongoose model instance)
 * @returns {Promise<Object>} { success: boolean, refunded: boolean, error?: string }
 */
export async function autoExpireBooking(booking) {
  try {
    const now = new Date();
    const check = shouldAutoExpireBooking(booking, now);
    
    if (!check.shouldExpire) {
      return { success: false, refunded: false, error: `Not eligible for auto-expiry: ${check.reason}` };
    }

    // Update booking status
    booking.status = "cancelled";
    booking.cancelledBy = "system";
    booking.cancellationReason = `Auto-cancelled: No provider assigned within ${BOOKING_AUTO_CANCEL_THRESHOLD_MINUTES} minutes of slot time`;
    booking.cancelledAt = now;
    booking.autoExpiredAt = now;
    booking.autoExpireReason = check.reason;
    booking.autoExpireNotified = false; // Will be set to true after notification

    await booking.save();

    // Log the auto-expiry
    await BookingLog.create({
      action: "booking:auto-expire",
      bookingId: booking._id.toString(),
      meta: { 
        reason: check.reason, 
        diffMinutes: check.diffMinutes,
        threshold: BOOKING_AUTO_CANCEL_THRESHOLD_MINUTES 
      }
    });

    console.log(`[Auto-Expiry] Booking ${booking._id} auto-expired. Reason: ${check.reason}, Diff: ${check.diffMinutes} mins`);

    // Process refund if payment was made
    let refunded = false;
    if (booking.prepaidAmount > 0 || booking.walletAmountUsed > 0) {
      try {
        const refundResult = await processSmartRefund(booking._id.toString(), {
          reason: "auto_expired",
          initiatedBy: "system",
        });
        refunded = refundResult.success;
        console.log(`[Auto-Expiry] Refund ${refunded ? "successful" : "failed"} for booking ${booking._id}`);
      } catch (refundError) {
        console.error(`[Auto-Expiry] Refund error for booking ${booking._id}:`, refundError.message);
      }
    }

    // Notify user
    try {
      const isVendorRebook =
        booking.vendorEscalated === true &&
        !booking.assignedProvider;
      const rebookMessage = "Kindly rebook the service, no provider was free for that time.";
      const defaultMessage = `Your booking #${booking._id.toString().slice(-6)} has been cancelled as we couldn't assign a professional in time.${refunded ? " Your payment has been refunded." : ""}`;
      await notify({
        recipientId: booking.customerId,
        recipientRole: "user",
        title: "Booking Cancelled",
        message: isVendorRebook ? rebookMessage : defaultMessage,
        type: "booking_cancel",
        meta: { 
          bookingId: booking._id.toString(), 
          reason: "auto_expired",
          refunded 
        },
      });

      booking.autoExpireNotified = true;
      if (isVendorRebook && !booking.rebookNotifiedAt) {
        booking.rebookNotifiedAt = now;
      }
      await booking.save();
    } catch (notifyError) {
      console.error(`[Auto-Expiry] Notification error for booking ${booking._id}:`, notifyError.message);
    }

    // Emit socket event
    try {
      const io = getIO();
      io?.of("/bookings").emit("status:update", { 
        id: booking._id.toString(), 
        status: "cancelled",
        reason: "auto_expired",
        message: "Booking auto-cancelled due to no provider assignment"
      });
    } catch (socketError) {
      console.error(`[Auto-Expiry] Socket error for booking ${booking._id}:`, socketError.message);
    }

    return { success: true, refunded };
  } catch (error) {
    console.error(`[Auto-Expiry] Error processing booking ${booking._id}:`, error.message);
    return { success: false, refunded: false, error: error.message };
  }
}

/**
 * Process all bookings that need auto-expiry
 * Called by cron job every 5 minutes
 * @returns {Promise<Object>} { processed: number, expired: number, refunded: number, errors: number }
 */
export async function processAutoExpiredBookings() {
  try {
    const now = new Date();
    
    // Find all pending bookings that are escalated (vendor or admin)
    const candidates = await Booking.find({
      status: "pending",
      $or: [
        { vendorEscalated: true },
        { adminEscalated: true }
      ],
      autoExpiredAt: null, // Not already auto-expired
    }).limit(100); // Process max 100 at a time

    if (candidates.length === 0) {
      return { processed: 0, expired: 0, refunded: 0, errors: 0 };
    }

    console.log(`[Auto-Expiry] Checking ${candidates.length} escalated bookings for auto-expiry...`);

    let expired = 0;
    let refunded = 0;
    let errors = 0;

    for (const booking of candidates) {
      const check = shouldAutoExpireBooking(booking, now);
      
      if (check.shouldExpire) {
        const result = await autoExpireBooking(booking);
        if (result.success) {
          expired++;
          if (result.refunded) refunded++;
        } else {
          errors++;
        }
      }
    }

    console.log(`[Auto-Expiry] Processed ${candidates.length} bookings: ${expired} expired, ${refunded} refunded, ${errors} errors`);

    return { 
      processed: candidates.length, 
      expired, 
      refunded, 
      errors 
    };
  } catch (error) {
    console.error("[Auto-Expiry] Error in processAutoExpiredBookings:", error.message);
    return { processed: 0, expired: 0, refunded: 0, errors: 1 };
  }
}
