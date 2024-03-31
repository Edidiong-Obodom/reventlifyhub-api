import { Router } from "express";
import {
  login,
  register,
  resetPW,
  sendPWResetCode,
  sendVerificationCode,
} from "../controllers/auth/authController";

const router = Router();

// sends verification code for reg
router.post("/send-code", sendVerificationCode);

// registers user
router.post("/register", register);

// login user
router.post("/login", login);

// sends verification code for password reset
router.post("/pw-reset-code", sendPWResetCode);

// resets password
router.post("/pw-reset", resetPW);

export default router;
