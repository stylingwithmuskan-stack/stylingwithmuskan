
import SubscriptionPlan from "../../../models/SubscriptionPlan.js";
import UserSubscription from "../../../models/UserSubscription.js";
import { createSubscriptionOrder } from "../../../lib/payment.service.js";

export async function getSubscriptionPlans(req, res) {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true });
    res.json({ plans });
  } catch (error) {
    res.status(500).json({ error: "Could not fetch subscription plans." });
  }
}

export async function subscribeToPlan(req, res) {
  const { planId, userId, userType } = req.body;

  if (!planId || !userId || !userType) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  try {
    const plan = await SubscriptionPlan.findOne({ planId, isActive: true });
    if (!plan) {
      return res.status(404).json({ error: "Subscription plan not found." });
    }

    const order = await createSubscriptionOrder(plan, userId, userType);
    res.json({ order });
  } catch (error) {
    res.status(500).json({ error: "Could not subscribe to plan." });
  }
}

export async function handlePaymentWebhook(req, res) {
  // In a real implementation, you would verify the webhook signature
  // to ensure it came from the payment gateway.
  const { orderId, paymentId, status, planId, userId, userType } = req.body;

  if (status === "success") {
    try {
      const plan = await SubscriptionPlan.findOne({ planId });
      if (!plan) {
        return res.status(404).json({ error: "Subscription plan not found." });
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + plan.durationDays);

      const subscription = new UserSubscription({
        userId,
        userType,
        planId,
        subscriptionId: `sub_${Date.now()}`, // In reality, this comes from the gateway
        status: "active",
        startDate,
        endDate,
        paymentDetails: {
          gateway: "placeholder",
          paymentId,
          orderId,
        },
      });

      await subscription.save();
      res.json({ message: "Subscription activated successfully." });
    } catch (error) {
      res.status(500).json({ error: "Could not activate subscription." });
    }
  } else {
    res.status(400).json({ error: "Payment failed." });
  }
}
