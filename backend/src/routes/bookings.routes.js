import { Router } from "express";
import { body, query } from "express-validator";
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

export default router;
