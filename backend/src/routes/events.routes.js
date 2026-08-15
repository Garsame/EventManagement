import { Router } from "express";
import { getEvent, listPublic } from "../controllers/events.controller.js";

const router = Router();

router.get("/public", listPublic);
router.get("/:eventId", getEvent);

export default router;
