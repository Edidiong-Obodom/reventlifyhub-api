import { Router } from "express";
import authenticateToken from "../../utilities/authenticateToken/authenticateToken";
import {
  createRegime,
  editRegime,
  fetchImage,
  instagramBasicDisplayInit,
  nameAvailability,
  ticketPurchase,
  ticketTransfer,
} from "../controllers/users/usersController";
import { paystackWebhook } from "../controllers/users/payments";
import { allRateLimiter } from "../../utilities/rate-limit/all-rate-limit";

const router = Router();

// ========== Services ==========
// Check regime name availability
router.get(
  "/regime/name/availability",
  authenticateToken,
  allRateLimiter,
  nameAvailability
);

// Create new regime
router.post("/regime/create", authenticateToken, allRateLimiter, createRegime);

// Edit regime details
router.patch("/regime/edit", authenticateToken, allRateLimiter, editRegime);

// Ticket purchase
router.post("/ticket/purchase", authenticateToken, ticketPurchase);

// Ticket transfer
router.post("/ticket/transfer", authenticateToken, ticketTransfer);
// ========== Services ==========

// ========== Payments ==========
router.post("/ticket/purchase/paystack-webhook", paystackWebhook);
// ========== Payments ==========

// ========== Archive APIs ==========
router.post("/insta-init", authenticateToken, instagramBasicDisplayInit);
router.get("/insta-images", authenticateToken, fetchImage);
// ========== Archive APIs ==========

export default router;
