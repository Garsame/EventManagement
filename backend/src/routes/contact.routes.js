import { Router } from "express";
import { submitMessage } from "../controllers/contact.controller.js";
import { contactLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.post("/", contactLimiter, submitMessage);

export default router;
