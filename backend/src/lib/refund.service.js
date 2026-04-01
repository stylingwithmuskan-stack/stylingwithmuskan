import Razorpay from "razorpay";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import BookingLog from "../models/BookingLog.js";
import { notify } from "./notify.js";
import { getSubscriptionSnapshot } from "./subscriptions.js";
import { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } from "../config.js";

/**
 * Calculate refund policy based on booking status, timing, and subscription
 */
export function calculateRefundPolicy(booking, cancelledBy, subscription = null) {
  const bookingTime = new Date(`${booking.slot.date}T${booking.slot.time}`);
  const now = new Date();
  const hoursUntilBooking = (bookingTime - now) / (1000 * 60 * 60);
  const status = (booking.status || "").toLowerCase();
  
  let refundPercentage = 0;
  let providerCompensation = 0;
  let providerPenalty = 0;
  
  // Provider cancellation - full refund to user
  if (cancelledBy === "provider") {
    refundPercentage = 100;
    providerPenalty = Math.round((booking.totalAmount || 0) * 0.2);
    return {
      refundPercentage,
      cancellationCharge: 0,
      providerCompensation: 0,
      providerPenalty,
      reason: "provider_cancellation"
    };
  }
  
  // Admin cancellation - full refund
  if (cancelledBy === "admin") {
    refundPercentage = 100;
    return {
      refundPercentage,
      cancellationCharge: 0,
      providerCompensation: 0,
      providerPenalty: 0,
      reason: "admin_cancellation"
    };
  }
  
  // Customer cancellation - based on status and timing
  if (cancelledBy === "customer") {
    // Status-based adjustments
    if (status === "travelling") {
      refundPercentage = 25;
      providerCompensation = Math.round((booking.totalAmount || 0) * 0.3);
    } else if (status === "accepted") {
      // Base refund reduced by 50% after acceptance
      if (hoursUntilBooking > 48) refundPercentage = 50;
      else if (hoursUntilBooking > 24) refundPercentage = 45;
      else if (hoursUntilBooking > 12) refundPercentage = 37.5;
      else if (hoursUntilBooking > 6) refundPercentage = 25;
      else if (hoursUntilBooking > 2) refundPercentage = 12.5;
      else refundPercentage = 0;
      
      providerCompensation = Math.round((booking.totalAmount || 0) * 0.1);
    } else {
      // Pending/incoming status - standard policy
      if (hoursUntilBooking > 48) refundPercentage = 100;
      else if (hoursUntilBooking > 24) refundPercentage = 90;
      else if (hoursUntilBooking > 12) refundPercentage = 75;
      else if (hoursUntilBooking > 6) refundPercentage = 50;
      else if (hoursUntilBooking > 2) refundPercentage = 25;
      else refundPercentage = 0;
    }
    
    // Apply subscription benefits
    if (subscription?.isPlusMember) {
      const freeWindow = subscription.freeCancellationWindowHours || 0;
      if (hoursUntilBooking > freeWindow) {
        refundPercentage = 100;
        providerCompensation = 0;
      } else {
        // Reduce charges by subscription benefit
        const chargeReduction = subscription.billingCycle === "annual" ? 0.75 : 0.5;
        const cancellationCharge = 100 - refundPercentage;
        const reducedCharge = cancellationCharge * (1 - chargeReduction);
        refundPercentage = 100 - reducedCharge;
      }
    }
  }
  
  const cancellationCharge = 100 - refundPercentage;
  
  return {
    refundPercentage,
    cancellationCharge,
    providerCompensation,
    providerPenalty,
    reason: `customer_cancellation_${status}_${Math.round(hoursUntilBooking)}h`
  };
}

/**
 * Process smart refund based on payment sources
 */
export async function processSmartRefund({
  booking,
  user,
  refundAmount,
  reason = "cancellation"
}) {
  if (refundAmount <= 0) {
    return {
      success: true,
      refunds: [],
      totalRefunded: 0,
      status: "none"
    };
  }
  
  // Get payment sources (backward compatible)
  let paymentSources = booking.paymentSources || [];
  
  // Backward compatibility: if no paymentSources, create from existing fields
  if (paymentSources.length === 0 && booking.prepaidAmount > 0) {
    if (booking.walletAmountUsed > 0) {
      paymentSources.push({
        source: "wallet",
        amount: booking.walletAmountUsed,
        transactionId: booking.walletTransactionId || "",
        paidAt: booking.createdAt
      });
    }
    if (booking.onlineAmountPaid > 0 || (booking.prepaidAmount > booking.walletAmountUsed)) {
      const onlineAmount = booking.onlineAmountPaid || (booking.prepaidAmount - (booking.walletAmountUsed || 0));
      paymentSources.push({
        source: "razorpay",
        amount: onlineAmount,
        paymentId: booking.paymentId || booking.paymentOrder?.id || "",
        paidAt: booking.createdAt
      });
    }
  }
  
  const refunds = [];
  let remainingRefund = refundAmount;
  
  console.log(`[SmartRefund] Processing refund: bookingId=${booking._id}, amount=₹${refundAmount}`);
  console.log(`[SmartRefund] Payment sources:`, paymentSources);
  
  // Process refunds in reverse order (LIFO)
  for (let i = paymentSources.length - 1; i >= 0 && remainingRefund > 0; i--) {
    const source = paymentSources[i];
    const refundForThisSource = Math.min(source.amount, remainingRefund);
    
    console.log(`[SmartRefund] Processing ${source.source} refund: ₹${refundForThisSource}`);
    
    if (source.source === "wallet") {
      // Wallet refund - instant
      try {
        const walletRefund = await processWalletRefund({
          user,
          amount: refundForThisSource,
          bookingId: booking._id.toString(),
          reason
        });
        
        refunds.push({
          source: "wallet",
          amount: refundForThisSource,
          status: "processed",
          transactionId: walletRefund.transactionId,
          refundedAt: new Date()
        });
        
        remainingRefund -= refundForThisSource;
        
        console.log(`[SmartRefund] Wallet refund successful: ₹${refundForThisSource}`);
        
      } catch (error) {
        console.error(`[SmartRefund] Wallet refund failed:`, error);
        
        refunds.push({
          source: "wallet",
          amount: refundForThisSource,
          status: "failed",
          error: error.message
        });
      }
      
    } else if (source.source === "razorpay") {
      // Online refund - via Razorpay
      const paymentId = source.paymentId || booking.paymentId || booking.paymentOrder?.id;
      
      if (!paymentId) {
        console.error(`[SmartRefund] No payment ID found for Razorpay refund`);
        refunds.push({
          source: "razorpay",
          amount: refundForThisSource,
          status: "failed",
          error: "Payment ID not found"
        });
        continue;
      }
      
      try {
        const razorpayRefund = await processRazorpayRefund({
          paymentId,
          amount: refundForThisSource,
          reason,
          bookingId: booking._id.toString()
        });
        
        refunds.push({
          source: "razorpay",
          amount: refundForThisSource,
          status: "processing",
          refundId: razorpayRefund.refund_id,
          refundedAt: null
        });
        
        remainingRefund -= refundForThisSource;
        
        console.log(`[SmartRefund] Razorpay refund initiated: ₹${refundForThisSource}, refundId=${razorpayRefund.refund_id}`);
        
      } catch (error) {
        console.error(`[SmartRefund] Razorpay refund failed:`, error);
        
        refunds.push({
          source: "razorpay",
          amount: refundForThisSource,
          status: "failed",
          error: error.message
        });
      }
    }
  }
  
  // Update booking with refund details
  booking.refunds = refunds;
  booking.refundAmount = refundAmount;
  
  // Determine overall refund status
  const allProcessed = refunds.every(r => r.status === "processed");
  const anyFailed = refunds.some(r => r.status === "failed");
  const anyProcessing = refunds.some(r => r.status === "processing");
  
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
  
  // Notify user about refund
  await notifyUserAboutRefund(user, booking, refunds);
  
  return {
    success: true,
    refunds,
    totalRefunded: refundAmount - remainingRefund,
    status: booking.refundStatus
  };
}

/**
 * Process wallet refund (instant)
 */
async function processWalletRefund({ user, amount, bookingId, reason }) {
  if (!user.wallet) {
    user.wallet = { balance: 0, transactions: [] };
  }
  
  // Add to wallet balance
  const oldBalance = Number(user.wallet.balance || 0);
  user.wallet.balance = oldBalance + amount;
  
  // Create transaction ID
  const transactionId = `refund_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // Add transaction record
  user.wallet.transactions.unshift({
    type: "refund",
    amount: amount,
    balanceAfter: user.wallet.balance,
    title: "Booking Refund",
    description: `Refund for cancelled booking #${bookingId.slice(-6)}`,
    bookingId: bookingId,
    refundId: transactionId,
    at: new Date()
  });
  
  await user.save();
  
  console.log(`[WalletRefund] Refund processed: userId=${user._id}, amount=₹${amount}, newBalance=₹${user.wallet.balance}`);
  
  return {
    success: true,
    transactionId,
    newBalance: user.wallet.balance
  };
}

/**
 * Process Razorpay refund
 */
async function processRazorpayRefund({ paymentId, amount, reason, bookingId }) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay keys not configured");
  }
  
  const rzp = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
  });
  
  const refund = await rzp.payments.refund(paymentId, {
    amount: Math.round(amount * 100),
    speed: "normal",
    notes: {
      bookingId,
      reason,
      timestamp: new Date().toISOString()
    }
  });
  
  return {
    success: true,
    refund_id: refund.id,
    amount: refund.amount / 100,
    status: refund.status
  };
}

/**
 * Notify user about refund with breakdown
 */
async function notifyUserAboutRefund(user, booking, refunds) {
  const walletRefunds = refunds.filter(r => r.source === "wallet");
  const onlineRefunds = refunds.filter(r => r.source === "razorpay");
  
  const walletAmount = walletRefunds.reduce((sum, r) => sum + r.amount, 0);
  const onlineAmount = onlineRefunds.reduce((sum, r) => sum + r.amount, 0);
  
  let message = `Your booking #${booking._id.toString().slice(-6)} has been cancelled. `;
  
  if (walletAmount > 0 && onlineAmount > 0) {
    message += `Refund breakdown: ₹${walletAmount} credited to wallet (instant), ₹${onlineAmount} will be credited to your bank account in 5-7 business days.`;
  } else if (walletAmount > 0) {
    message += `₹${walletAmount} has been credited to your wallet instantly.`;
  } else if (onlineAmount > 0) {
    message += `₹${onlineAmount} will be credited to your bank account in 5-7 business days.`;
  }
  
  await notify({
    recipientId: user._id.toString(),
    recipientRole: "user",
    title: "Booking Cancelled - Refund Processed",
    message,
    type: "booking_cancelled_refund",
    meta: {
      bookingId: booking._id.toString(),
      walletRefund: walletAmount,
      onlineRefund: onlineAmount,
      totalRefund: walletAmount + onlineAmount
    }
  });
}
