import { Router } from "express";
import {
  login,
  register,
  resetPW,
  sendPWResetCode,
  sendVerificationCode,
  verifyPwResetCode,
} from "../controllers/auth/authController";
import { loginRateLimiter } from "../../utilities/rate-limit";
import { allRateLimiter } from "../../utilities/rate-limit/all-rate-limit";
import { auditMiddleware } from "../../utilities/auditMiddleware";

const router = Router();

// sends verification code for reg
router.post(
  "/signup/send-code",
  allRateLimiter,
  auditMiddleware(),
  sendVerificationCode
);

// registers user
router.post("/signup/register", allRateLimiter, auditMiddleware(), register);

// login user
router.post("/login", loginRateLimiter, auditMiddleware(), login);

// sends verification code for password reset
router.post(
  "/pw-reset-code",
  allRateLimiter,
  auditMiddleware(),
  sendPWResetCode
);

// verifies password reset code
router.post(
  "/pw-reset-code/verify",
  allRateLimiter,
  auditMiddleware(),
  verifyPwResetCode
);

// resets password
router.post("/pw-reset", allRateLimiter, auditMiddleware(), resetPW);

export default router;
