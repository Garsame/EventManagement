import { Router } from "express";
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  setUserPassword,
  setUserStatus,
  updateUser,
} from "../controllers/admin.users.controller.js";
import { requireAuth } from "../middleware/auth.js";
import requireRole from "../middleware/role.js";

const router = Router();

// Account administration is admin-only throughout.
router.use(requireAuth, requireRole("admin"));

router.get("/", listUsers);
router.post("/", createUser);
router.get("/:userId", getUser);
router.patch("/:userId", updateUser);
router.patch("/:userId/password", setUserPassword);
router.patch("/:userId/status", setUserStatus);
router.delete("/:userId", deleteUser);

export default router;
