import { Router } from "express";
import authenticateToken from "../../utilities/authenticateToken/authenticateToken";
import {
  byPopularity,
  createRegime,
  editRegime,
  fetchImage,
  getAllEvents,
  instagramBasicDisplayInit,
  nameAvailability,
  regimeImageEdit,
  searchEvents,
  ticketList,
  ticketPurchase,
  ticketSearch,
  ticketTransfer,
} from "../controllers/users/usersController";
import { paystackWebhook } from "../controllers/users/payments";
import { allRateLimiter } from "../../utilities/rate-limit/all-rate-limit";
import {
  transactionList,
  transactionSearch,
} from "../controllers/users/services/transactions";

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

// ========== Edit regime details ==========
router.patch("/regime/edit", authenticateToken, allRateLimiter, editRegime);
router.patch(
  "/regime/edit/image",
  authenticateToken,
  allRateLimiter,
  regimeImageEdit
);
// ========== Edit regime details ==========

// ========== View regimes ==========
router.get("/regime/search", searchEvents);
router.get("/regime/view", getAllEvents);
router.get("/regime/view/popular", byPopularity);
// ========== View regimes ==========

// ========== Ticket actions ==========
// Ticket purchase
router.post("/tickets/purchase", authenticateToken, ticketPurchase);

// Ticket transfer
router.post("/tickets/transfer", authenticateToken, ticketTransfer);

// Ticket list
router.get("/tickets/list", authenticateToken, allRateLimiter, ticketList);

// Ticket search
router.get("/tickets/search", authenticateToken, allRateLimiter, ticketSearch);
// ========== Ticket actions ==========

// ========== Transaction actions ==========
// Ticket list
router.get(
  "/transactions/list",
  authenticateToken,
  allRateLimiter,
  transactionList
);

// Ticket search
router.get(
  "/transactions/search",
  authenticateToken,
  allRateLimiter,
  transactionSearch
);
// ========== Transaction actions ==========

// ========== Services ==========

// ========== Payments ==========
router.post("/ticket/purchase/paystack-webhook", paystackWebhook);
// ========== Payments ==========

// ========== Archive APIs ==========
router.post("/insta-init", authenticateToken, instagramBasicDisplayInit);
router.get("/insta-images", authenticateToken, fetchImage);
// ========== Archive APIs ==========

export default router;
