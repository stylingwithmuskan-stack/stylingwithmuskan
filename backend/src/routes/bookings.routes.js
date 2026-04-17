import { Router } from "express";
import { body, query, validationResult } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import * as BookingsController from "../modules/bookings/controllers/bookings.controller.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  BookingsController.list
);

router.post(
  "/quote",
  requireAuth,
  body("items").isArray({ min: 1 }),
  body("couponCode").optional().isString(),
  BookingsController.quote
);

router.post(
  "/",
  requireAuth,
  body("items").isArray({ min: 1 }),
  body("slot.date").isString(),
  body("slot.time").isString(),
  body("address.houseNo").isString(),
  body("address.area").isString(),
  body("bookingType").isString(),
  body("couponCode").optional().isString(),
  body("preferredProviderId").optional().isString(),
  body("autoAssign").optional().isBoolean(),
  BookingsController.create
);

// Custom Enquiry (User)
router.post(
  "/custom-enquiry",
  requireAuth,
  body("name").isString(),
  body("phone").isString(),
  body("eventType").isString(),
  body("noOfPeople").isString(),
  body("date").isString(),
  body("timeSlot").isString(),
  body("selectedServices").isArray({ min: 1 }),
  body("notes").optional().isString(),
  BookingsController.createCustomEnquiry
);
router.get(
  "/custom-enquiry",
  requireAuth,
  BookingsController.listCustomEnquiries
);
router.patch(
  "/custom-enquiry/:id/user-accept",
  requireAuth,
  BookingsController.userAcceptCustomEnquiry
);
router.patch(
  "/custom-enquiry/:id/advance-paid",
  requireAuth,
  body("amount").optional().isNumeric(),
  BookingsController.userMarkCustomAdvancePaid
);
router.patch(
  "/custom-enquiry/:id/user-reject",
  requireAuth,
  BookingsController.userRejectCustomEnquiry
);

router.get(
  "/:id/track",
  requireAuth,
  BookingsController.track
);

router.patch(
  "/:id/confirm-cod",
  requireAuth,
  BookingsController.confirmCOD
);

router.get(
  "/:id",
  requireAuth,
  BookingsController.getById
);

router.patch(
  "/:id/cancel",
  requireAuth,
  BookingsController.cancel
);

// Feedback submission
router.post(
  "/:id/feedback",
  requireAuth,
  body("rating").isInt({ min: 1, max: 5 }),
  body("comment").optional().isString(),
  body("tags").optional().isArray(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const Feedback = (await import("../models/Feedback.js")).default;
      const Booking = (await import("../models/Booking.js")).default;
      const { updateProviderRating } = await import("../lib/updateProviderRating.js");

      const booking = await Booking.findById(req.params.id).lean();
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      // Verify booking belongs to user
      if (booking.customerId !== req.user._id.toString()) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Check if feedback already exists
      let feedback = await Feedback.findOne({ bookingId: req.params.id });
      
      if (feedback) {
        // Update existing feedback
        feedback.rating = req.body.rating;
        feedback.comment = req.body.comment || "";
        feedback.tags = req.body.tags || [];
        feedback.updatedAt = new Date();
        await feedback.save();
      } else {
        // Create new feedback
        feedback = await Feedback.create({
          bookingId: req.params.id,
          customerId: req.user._id.toString(),
          customerName: req.user.name || booking.customerName || "Customer",
          providerId: booking.assignedProvider || "",
          providerName: booking.assignedProvider ? "Provider" : "",
          serviceName: booking.services?.[0]?.name || "Service",
          serviceCategory: booking.services?.[0]?.category || "",
          rating: req.body.rating,
          comment: req.body.comment || "",
          tags: req.body.tags || [],
          type: "customer_to_provider",
          status: "active",
        });
      }

      // Update provider rating if provider is assigned
      if (booking.assignedProvider) {
        await updateProviderRating(booking.assignedProvider);
      }

      res.status(feedback.isNew ? 201 : 200).json({ success: true, feedback });
    } catch (error) {
      console.error("[Feedback] Error:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  }
);

export default router;
