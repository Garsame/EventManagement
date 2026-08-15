import { Router } from "express";
import {
  createEvent,
  deleteEvent,
  listAllEvents,
  listPhotographers,
  setEventPhotographers,
  updateEvent,
  uploadEventCover,
} from "../controllers/admin.events.controller.js";
import { requireAuth } from "../middleware/auth.js";
import requireRole from "../middleware/role.js";
import upload, { handleUploadErrors } from "../middleware/upload.js";

const router = Router();

// Photographers may read the list so they can find the events they are on;
// everything that changes data stays admin-only.
router.get("/", requireAuth, requireRole("admin", "photographer"), listAllEvents);

router.post("/", requireAuth, requireRole("admin"), createEvent);
router.get("/photographers", requireAuth, requireRole("admin"), listPhotographers);
router.patch("/:eventId", requireAuth, requireRole("admin"), updateEvent);
router.put("/:eventId/photographers", requireAuth, requireRole("admin"), setEventPhotographers);
router.post(
  "/:eventId/cover",
  requireAuth,
  requireRole("admin"),
  upload.single("file"),
  handleUploadErrors,
  uploadEventCover
);
router.delete("/:eventId", requireAuth, requireRole("admin"), deleteEvent);

export default router;
