import { Router } from "express";
import { listActivity } from "../controllers/admin.activity.controller.js";
import { requireAuth } from "../middleware/auth.js";
import requireRole from "../middleware/role.js";

const router = Router();

router.get("/", requireAuth, requireRole("admin"), listActivity);

export default router;
