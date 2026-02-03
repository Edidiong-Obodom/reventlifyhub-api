import { Router } from "express";
import authenticateToken from "../../utilities/authenticateToken/authenticateToken";
import {
  byPopularity,
  createRegime,
  editRegime,
  fetchImage,
  getAllEvents,
  instagramBasicDisplayInit,
  bookmarkRegime,
  listBookmarkIds,
  listBookmarks,
  nameAvailability,
  getProfile,
  getRegimesByCreator,
  getUserProfileById,
  followUser,
  regimeImageEdit,
  searchEvents,
  unfollowUser,
  unbookmarkRegime,
  updateLocation,
  updateProfile,
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
import { auditMiddleware } from "../../utilities/auditMiddleware";

const router = Router();

// ========== Services ==========
// Check regime name availability
router.get(
  "/regime/name/availability",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  nameAvailability
);

// Create new regime
router.post(
  "/regime/create",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  createRegime
);

// ========== Edit regime details ==========
router.patch(
  "/regime/edit",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  editRegime
);
router.patch(
  "/regime/edit/image",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  regimeImageEdit
);
// ========== Edit regime details ==========

// ========== View regimes ==========
router.get("/regime/search", auditMiddleware(), searchEvents);
router.get("/regime/view", auditMiddleware(), getAllEvents);
router.get("/regime/view/popular", auditMiddleware(), byPopularity);
// ========== View regimes ==========

// ========== Profile ==========
router.get(
  "/profile",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  getProfile
);
router.patch(
  "/profile",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  updateProfile
);
router.patch(
  "/profile/location",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  updateLocation
);
router.get(
  "/profile/:id",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  getUserProfileById
);
router.get(
  "/profile/:id/regimes",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  getRegimesByCreator
);
router.post(
  "/profile/:id/follow",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  followUser
);
router.delete(
  "/profile/:id/follow",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  unfollowUser
);
// ========== Profile ==========

// ========== Bookmarks ==========
router.get(
  "/regime/bookmarks",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  listBookmarks
);
router.get(
  "/regime/bookmarks/ids",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  listBookmarkIds
);
router.post(
  "/regime/bookmark",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  bookmarkRegime
);
router.delete(
  "/regime/bookmark",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  unbookmarkRegime
);
// ========== Bookmarks ==========

// ========== Ticket actions ==========
// Ticket purchase
router.post(
  "/tickets/purchase",
  authenticateToken,
  auditMiddleware(),
  ticketPurchase
);

// Ticket transfer
router.post(
  "/tickets/transfer",
  authenticateToken,
  auditMiddleware(),
  ticketTransfer
);

// Ticket list
router.get(
  "/tickets/list",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  ticketList
);

// Ticket search
router.get(
  "/tickets/search",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  ticketSearch
);
// ========== Ticket actions ==========

// ========== Transaction actions ==========
// Ticket list
router.get(
  "/transactions/list",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  transactionList
);

// Ticket search
router.get(
  "/transactions/search",
  authenticateToken,
  allRateLimiter,
  auditMiddleware(),
  transactionSearch
);
// ========== Transaction actions ==========

// ========== Services ==========

// ========== Payments ==========
router.post(
  "/ticket/purchase/paystack-webhook",
  auditMiddleware(),
  paystackWebhook
);
// ========== Payments ==========

// ========== Archive APIs ==========
router.post("/insta-init", authenticateToken, instagramBasicDisplayInit);
router.get("/insta-images", authenticateToken, fetchImage);
// ========== Archive APIs ==========

export default router;
