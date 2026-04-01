import { Router } from "express";
import { body, param } from "express-validator";
import { requireRole } from "../../../middleware/roles.js";
import * as VendorController from "../controllers/vendor.controller.js";

const router = Router();

router.post("/register", body("name").isString(), body("email").isString(), VendorController.register);
router.post("/register-request", body("phone").matches(/^\d{10}$/), VendorController.registerRequest);
router.post("/verify-registration-otp", body("phone").matches(/^\d{10}$/), body("otp").isLength({ min: 6, max: 6 }), VendorController.verifyRegistrationOtp);
router.post("/login", body("email").isString(), body("password").isString(), VendorController.login);
router.post("/logout", VendorController.logout);
router.post("/request-otp", body("phone").matches(/^\d{10}$/), VendorController.requestOtp);
router.post("/verify-otp", body("phone").matches(/^\d{10}$/), body("otp").isLength({ min: 6, max: 6 }), VendorController.verifyOtp);
router.get("/me", requireRole("vendor"), VendorController.getMe);

router.get("/providers", requireRole("vendor"), VendorController.listProviders);
router.patch(
  "/providers/:id/status",
  requireRole("vendor"),
  param("id").isString(),
  body("status").isIn(["approved", "pending", "rejected", "blocked"]),
  VendorController.updateProviderStatus
);
router.patch("/providers/:id/approve-zones", requireRole("vendor"), param("id").isString(), VendorController.approveSPZones);
router.patch("/providers/:id/reject-zones", requireRole("vendor"), param("id").isString(), VendorController.rejectSPZones);

router.get("/bookings", requireRole("vendor"), VendorController.listBookings);
router.patch(
  "/bookings/:id/assign",
  requireRole("vendor"),
  param("id").isString(),
  body("providerId").isString(),
  VendorController.assignBooking
);
router.patch(
  "/bookings/:id/reassign",
  requireRole("vendor"),
  param("id").isString(),
  body("providerId").isString(),
  VendorController.reassignBooking
);
router.patch(
  "/bookings/:id/expire",
  requireRole("vendor"),
  param("id").isString(),
  VendorController.expireBooking
);
router.patch(
  "/bookings/:id/payout",
  requireRole("vendor"),
  param("id").isString(),
  body("status").isString().notEmpty(),
  VendorController.updateBookingPayoutStatus
);

// Custom enquiries (vendor)
router.get("/custom-enquiries", requireRole("vendor"), VendorController.listCustomEnquiries);
router.patch(
  "/custom-enquiries/:id/price-quote",
  requireRole("vendor"),
  param("id").isString(),
  body("totalAmount").isNumeric(),
  body("discountPrice").optional().isNumeric(),
  body("prebookAmount").optional().isNumeric(),
  body("totalServiceTime").optional().isString(),
  body("quoteExpiryAt").optional().isString(),
  body("quoteExpiryHours").optional().isNumeric(),
  body("notes").optional().isString(),
  VendorController.priceQuoteCustomEnquiry
);
router.patch(
  "/custom-enquiries/:id/team-assign",
  requireRole("vendor"),
  param("id").isString(),
  body("maintainerProvider").isString().notEmpty(),
  body("teamMembers").isArray({ min: 1 }),
  VendorController.assignTeamCustomEnquiry
);

router.get("/sos", requireRole("vendor"), VendorController.listSOS);
router.patch("/sos/:id/resolve", requireRole("vendor"), param("id").isString(), VendorController.resolveSOS);
router.get("/stats", requireRole("vendor"), VendorController.stats);
router.get("/subaccounts", requireRole("vendor"), VendorController.listSubAccounts);
router.post(
  "/subaccounts",
  requireRole("vendor"),
  body("name").isString().notEmpty(),
  body("email").optional().isString(),
  body("phone").optional().isString(),
  body("role").optional().isIn(["operations", "support", "finance"]),
  VendorController.createSubAccount
);
router.delete("/subaccounts/:id", requireRole("vendor"), param("id").isString(), VendorController.deleteSubAccount);

router.post(
  "/request-zones",
  requireRole("vendor"),
  body("zones").isArray({ min: 1 }),
  VendorController.requestZones
);

export default router;

