import { Router } from "express";
import {
  deleteAvatar,
  getMe,
  getMyRegistrations,
  updateMe,
  uploadAvatar,
} from "../controllers/users.controller.js";
import { requireAuth } from "../middleware/auth.js";
import upload, { handleUploadErrors } from "../middleware/upload.js";

const router = Router();

router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, updateMe);
router.get("/me/registrations", requireAuth, getMyRegistrations);

router.post("/me/avatar", requireAuth, upload.single("file"), handleUploadErrors, uploadAvatar);
router.delete("/me/avatar", requireAuth, deleteAvatar);

export default router;
