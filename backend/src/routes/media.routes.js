import { Router } from "express";
import { deleteMedia, listMediaForManagement, uploadMedia } from "../controllers/media.controller.js";
import { requireAuth } from "../middleware/auth.js";
import requireRole from "../middleware/role.js";
import upload, { handleUploadErrors } from "../middleware/upload.js";

const router = Router();

router.post(
  "/:eventId/media",
  requireAuth,
  requireRole("admin", "photographer"),
  upload.single("file"),
  handleUploadErrors,
  uploadMedia
);
router.get("/:eventId/media", requireAuth, requireRole("admin", "photographer"), listMediaForManagement);
router.delete("/:eventId/media/:mediaId", requireAuth, requireRole("admin", "photographer"), deleteMedia);

export default router;
