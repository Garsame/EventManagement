import { Router } from "express";
import {
  adminExists,
  adminLogin,
  adminSignup,
  login,
  logout,
  photographerLogin,
  refresh,
  register,
} from "../controllers/auth.controller.js";
import {
  cancelSignupOtp,
  changePasswordWithOtp,
  forgotPasswordRequest,
  forgotPasswordVerify,
  requestPasswordOtp,
  requestSignupOtp,
  verifySignupOtp,
} from "../controllers/otp.controller.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/register", authLimiter, register);
// Separate doors per realm. Each rejects roles that do not belong to it, so an
// admin cannot sign in on the public form even with the right password.
router.post("/login", authLimiter, login);
router.post("/admin/login", authLimiter, adminLogin);
router.get("/admin/exists", adminExists);
router.post("/admin/signup", authLimiter, adminSignup);
router.post("/photographer/login", authLimiter, photographerLogin);
router.post("/refresh", authLimiter, refresh);
router.post("/logout", logout);

// Email-verified signup: a User is only created once the code is confirmed.
router.post("/signup/request", authLimiter, requestSignupOtp);
router.post("/signup/verify", authLimiter, verifySignupOtp);
router.post("/signup/cancel", cancelSignupOtp);

// Password change for a signed-in user, confirmed by an emailed code.
router.post("/password/request-otp", authLimiter, requireAuth, requestPasswordOtp);
router.post("/password/change", authLimiter, requireAuth, changePasswordWithOtp);

// Recovery for someone who is locked out entirely - no session required.
// Realm-agnostic: works regardless of which login page the request came
// from, since it only needs proof of mailbox access.
router.post("/forgot-password/request", authLimiter, forgotPasswordRequest);
router.post("/forgot-password/verify", authLimiter, forgotPasswordVerify);

export default router;
