import { Router } from "express";
import { listMessages, replyToMessage } from "../controllers/contact.controller.js";
import { requireAuth } from "../middleware/auth.js";
import requireRole from "../middleware/role.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", listMessages);
router.post("/:messageId/reply", replyToMessage);

export default router;
