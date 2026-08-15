import { Router } from "express";
import { login, logout, refresh, register } from "../controllers/auth.controller.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", authLimiter, refresh);
router.post("/logout", logout);

export default router;
