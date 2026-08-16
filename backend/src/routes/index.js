import { Router } from "express";
import healthRoutes from "./health.routes.js";
import authRoutes from "./auth.routes.js";
import eventsRoutes from "./events.routes.js";
import adminEventsRoutes from "./admin.events.routes.js";
import registrationsRoutes from "./registrations.routes.js";
import mediaRoutes from "./media.routes.js";
import usersRoutes from "./users.routes.js";
import adminUsersRoutes from "./admin.users.routes.js";
import contactRoutes from "./contact.routes.js";
import adminMessagesRoutes from "./admin.messages.routes.js";
import adminActivityRoutes from "./admin.activity.routes.js";
import photographerRoutes from "./photographer.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/events", eventsRoutes);
router.use("/events", registrationsRoutes);
router.use("/events", mediaRoutes);
router.use("/admin/events", adminEventsRoutes);
router.use("/admin/users", adminUsersRoutes);
router.use("/contact", contactRoutes);
router.use("/admin/messages", adminMessagesRoutes);
router.use("/admin/activity", adminActivityRoutes);
router.use("/photographer", photographerRoutes);

export default router;
