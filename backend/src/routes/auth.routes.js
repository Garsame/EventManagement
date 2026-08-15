import { Router } from "express";
import { login, logout, refresh, register } from "../controllers/auth.controller.js";
import {
  cancelSignupOtp,
  changePasswordWithOtp,
  requestPasswordOtp,
  requestSignupOtp,
  verifySignupOtp,
} from "../controllers/otp.controller.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", authLimiter, refresh);
router.post("/logout", logout);

// Email-verified signup: a User is only created once the code is confirmed.
router.post("/signup/request", authLimiter, requestSignupOtp);
router.post("/signup/verify", authLimiter, verifySignupOtp);
router.post("/signup/cancel", cancelSignupOtp);

// Password change for a signed-in user, confirmed by an emailed code.
router.post("/password/request-otp", authLimiter, requireAuth, requestPasswordOtp);
router.post("/password/change", authLimiter, requireAuth, changePasswordWithOtp);

export default router;
