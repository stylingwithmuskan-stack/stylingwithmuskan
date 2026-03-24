
import { Router } from "express";
import * as SubscriptionController from "../controllers/subscription.controller.js";

const router = Router();

router.get("/plans", SubscriptionController.getSubscriptionPlans);
router.post("/subscribe", SubscriptionController.subscribeToPlan);
router.post("/webhook", SubscriptionController.handlePaymentWebhook);

export default router;
