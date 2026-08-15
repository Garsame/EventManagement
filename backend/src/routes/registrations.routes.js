import { Router } from "express";
import { checkIn, galleryGate, getMyRegistration, registerForEvent } from "../controllers/registrations.controller.js";
import { requireAuth } from "../middleware/auth.js";
import requireRole from "../middleware/role.js";

const router = Router();

// Registration
router.post("/:eventId/register", requireAuth, registerForEvent);
router.get("/:eventId/registration/me", requireAuth, getMyRegistration);

// Check-in (admin or photographer)
router.post("/:eventId/checkin", requireAuth, requireRole("admin", "photographer"), checkIn);

// Gallery gate
router.get("/:eventId/gallery", requireAuth, galleryGate);

export default router;
