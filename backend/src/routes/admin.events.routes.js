import { Router } from "express";
import { createEvent, updateEvent } from "../controllers/admin.events.controller.js";
import { requireAuth } from "../middleware/auth.js";
import requireRole from "../middleware/role.js";

const router = Router();

router.post("/", requireAuth, requireRole("admin"), createEvent);
router.patch("/:eventId", requireAuth, requireRole("admin"), updateEvent);

export default router;
