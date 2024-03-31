import { Router } from "express";
import {
  login,
  register,
  sendVerificationCode,
} from "../controllers/auth/authController";

const router = Router();

// sends verification code for reg
router.post("/send-code", sendVerificationCode);

// registers user
router.post("/register", register);

// login user
router.post("/login", login);

export default router;
