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

const router = Router();

// sends verification code for reg
router.post("/signup/send-code", allRateLimiter, sendVerificationCode);

// registers user
router.post("/signup/register", allRateLimiter, register);

// login user
router.post("/login", loginRateLimiter, login);

// sends verification code for password reset
router.post("/pw-reset-code", allRateLimiter, sendPWResetCode);

// verifies password reset code
router.post("/pw-reset-code/verify", allRateLimiter, verifyPwResetCode);

// resets password
router.post("/pw-reset", allRateLimiter, resetPW);

export default router;
