
import { Router } from "express";
import * as SubscriptionController from "../controllers/subscription.controller.js";

const router = Router();

router.get("/plans", SubscriptionController.getSubscriptionPlans);
router.get("/me", SubscriptionController.getMySubscription);
router.post("/order", SubscriptionController.createSubscriptionOrder);
router.post("/verify", SubscriptionController.verifySubscriptionPayment);
router.post("/webhook", SubscriptionController.handlePaymentWebhook);

export default router;
