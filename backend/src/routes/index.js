import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import eventsRoutes from "./events.routes.js";
import adminEventsRoutes from "./admin.events.routes.js";
import registrationsRoutes from "./registrations.routes.js";
import mediaRoutes from "./media.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/events", eventsRoutes);
router.use("/events", registrationsRoutes);
router.use("/events", mediaRoutes);
router.use("/admin/events", adminEventsRoutes);

export default router;
