import { Router } from "express";
import authenticateToken from "../../utilities/authenticateToken/authenticateToken";
import {
  createRegime,
  fetchImage,
  instagramBasicDisplayInit,
  isLoggedIn,
  nameAvailability,
  ticketPurchase,
} from "../controllers/users/usersController";
import { paystackWebhook } from "../controllers/users/payments";

const router = Router();

// Check regime name availability
router.get("/regime/name/availability", authenticateToken, nameAvailability);

// Create new regime
router.post("/regime/create", authenticateToken, createRegime);

// Create new regime
router.post("/tickets/purchase", authenticateToken, ticketPurchase);

// Payments
router.post("/tickets/purchase/paystack-webhook", paystackWebhook);

// Archive APIs
router.get("/isloggedin", authenticateToken, isLoggedIn);
router.post("/insta-init", authenticateToken, instagramBasicDisplayInit);
router.get("/insta-images", authenticateToken, fetchImage);

export default router;
