import { Router } from "express";
import {
  login,
  register,
  resetPW,
  sendPWResetCode,
  sendVerificationCode,
  verifyPwResetCode,
} from "../controllers/auth/authController";

const router = Router();

// sends verification code for reg
router.post("/signup/send-code", sendVerificationCode);

// registers user
router.post("/signup/register", register);

// login user
router.post("/login", login);

// sends verification code for password reset
router.post("/pw-reset-code", sendPWResetCode);

// verifies password reset code
router.post("/pw-reset-code/verify", verifyPwResetCode);

// resets password
router.post("/pw-reset", resetPW);

export default router;
