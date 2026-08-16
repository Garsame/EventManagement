import { Router } from "express";
import { getDashboard } from "../controllers/photographer.controller.js";
import { requireAuth } from "../middleware/auth.js";
import requireRole from "../middleware/role.js";

const router = Router();

router.get("/dashboard", requireAuth, requireRole("photographer"), getDashboard);

export default router;
