import { Router } from "express";
import {
  createEvent,
  deleteEvent,
  listAllEvents,
  listEventRegistrations,
  listPhotographers,
  listTrashedEvents,
  purgeEvent,
  restoreEvent,
  setCheckInOpen,
  setEventPhotographers,
  setRegistrationApproval,
  setRegistrationPayment,
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
router.get("/trash", requireAuth, requireRole("admin"), listTrashedEvents);
router.get("/:eventId/registrations", requireAuth, requireRole("admin"), listEventRegistrations);
router.patch("/:eventId", requireAuth, requireRole("admin"), updateEvent);
router.patch("/:eventId/restore", requireAuth, requireRole("admin"), restoreEvent);
router.put("/:eventId/photographers", requireAuth, requireRole("admin"), setEventPhotographers);
router.patch("/:eventId/checkin-open", requireAuth, requireRole("admin"), setCheckInOpen);
router.patch(
  "/:eventId/registrations/:registrationId/approval",
  requireAuth,
  requireRole("admin"),
  setRegistrationApproval
);
router.patch(
  "/:eventId/registrations/:registrationId/payment",
  requireAuth,
  requireRole("admin"),
  setRegistrationPayment
);
router.post(
  "/:eventId/cover",
  requireAuth,
  requireRole("admin"),
  upload.single("file"),
  handleUploadErrors,
  uploadEventCover
);
// DELETE moves an event to the trash; permanent really removes it.
router.delete("/:eventId", requireAuth, requireRole("admin"), deleteEvent);
router.delete("/:eventId/permanent", requireAuth, requireRole("admin"), purgeEvent);

export default router;
