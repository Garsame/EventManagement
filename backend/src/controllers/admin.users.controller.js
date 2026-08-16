import bcrypt from "bcrypt";
import crypto from "crypto";
import mongoose from "mongoose";
import User, { EDUCATION_LEVELS, SEX_OPTIONS, toUserDTO } from "../models/User.js";
import EventRegistration from "../models/EventRegistration.js";
import Event from "../models/Event.js";
import { sendAccountCredentialsEmail } from "../config/mailer.js";
import { logActivity } from "../utils/activityLog.js";

const formatError = (code, message) => ({ error: { code, message } });

const ROLES = ["attendee", "photographer", "admin"];

const LOGIN_PATHS = {
  // Each role signs in at its own door; the admin path is deliberately not
  // guessable from the public site.
  admin: "/maamul/login",
  photographer: "/photographer/login",
  attendee: "/login",
};

const appBaseUrl = () =>
  (process.env.APP_BASE_URL || process.env.CORS_ORIGIN || "http://localhost:5173").replace(/\/+$/, "");

const loginUrlFor = (role) => `${appBaseUrl()}${LOGIN_PATHS[role] || LOGIN_PATHS.attendee}`;

/** Readable but random, so admins never invent weak temporary passwords. */
const generatePassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const pick = () => alphabet[crypto.randomInt(0, alphabet.length)];
  return `${Array.from({ length: 10 }, pick).join("")}!${crypto.randomInt(10, 99)}`;
};

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);

export const listUsers = async (req, res, next) => {
  try {
    const { role, q, status } = req.query;
    const filter = {};
    if (role) {
      if (!ROLES.includes(role)) {
        return res.status(400).json(formatError("VALIDATION_ERROR", `role must be one of: ${ROLES.join(", ")}`));
      }
      filter.role = role;
    }
    if (status === "active") filter.isActive = { $ne: false };
    if (status === "inactive") filter.isActive = false;
    if (q) {
      const rx = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ fullName: rx }, { email: rx }, { phone: rx }, { institution: rx }];
    }

    const users = await User.find(filter).sort({ createdAt: -1 }).lean();

    // Attendee rows show how engaged each person is.
    const ids = users.filter((u) => u.role === "attendee").map((u) => u._id);
    const regs = ids.length
      ? await EventRegistration.aggregate([
          { $match: { userId: { $in: ids } } },
          { $group: { _id: "$userId", total: { $sum: 1 }, attended: { $sum: { $cond: ["$attended", 1, 0] } } } },
        ])
      : [];
    const regBy = new Map(regs.map((r) => [String(r._id), r]));

    // Photographer rows show how many events they are on.
    const assignments = await Event.aggregate([
      { $unwind: "$photographers" },
      { $group: { _id: "$photographers", n: { $sum: 1 } } },
    ]);
    const assignBy = new Map(assignments.map((a) => [String(a._id), a.n]));

    const counts = {
      attendee: await User.countDocuments({ role: "attendee" }),
      photographer: await User.countDocuments({ role: "photographer" }),
      admin: await User.countDocuments({ role: "admin" }),
    };

    return res.json({
      counts,
      users: users.map((u) => ({
        ...toUserDTO(u),
        registrationCount: regBy.get(String(u._id))?.total || 0,
        attendedCount: regBy.get(String(u._id))?.attended || 0,
        assignedEventCount: assignBy.get(String(u._id)) || 0,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).lean();
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));
    return res.json({ user: toUserDTO(user) });
  } catch (err) {
    return next(err);
  }
};

/**
 * Admin-created accounts skip email verification entirely: the admin is the
 * trusted party, so the account is live immediately.
 */
export const createUser = async (req, res, next) => {
  try {
    const { fullName, role, password, sendEmail = true } = req.body || {};
    const email = String(req.body?.email || "").toLowerCase().trim();

    if (!fullName || !email || !role) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "fullName, email and role are required"));
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", `role must be one of: ${ROLES.join(", ")}`));
    }
    if (!isValidEmail(email)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Invalid email format"));
    }
    if (password && String(password).length < 6) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Password must be at least 6 characters"));
    }
    if (await User.findOne({ email })) {
      return res.status(409).json(formatError("EMAIL_EXISTS", "Email is already registered"));
    }

    const plainPassword = password || generatePassword();

    const optional = {};
    ["phone", "location", "institution", "fieldOfStudy", "bio"].forEach((f) => {
      if (req.body?.[f]) optional[f] = req.body[f];
    });
    if (req.body?.educationLevel && EDUCATION_LEVELS.includes(req.body.educationLevel)) {
      optional.educationLevel = req.body.educationLevel;
    }
    if (req.body?.sex && SEX_OPTIONS.includes(req.body.sex)) optional.sex = req.body.sex;

    const user = await User.create({
      fullName,
      email,
      passwordHash: await bcrypt.hash(plainPassword, 10),
      role,
      isActive: true,
      createdBy: req.user.userId,
      refreshTokens: [],
      ...optional,
    });

    let delivered = false;
    if (sendEmail) {
      try {
        const result = await sendAccountCredentialsEmail({
          to: email,
          fullName,
          password: plainPassword,
          role,
          loginUrl: loginUrlFor(role),
        });
        delivered = result.delivered;
      } catch (err) {
        // The account exists; a failed email should not undo it.
        console.warn("Could not email credentials:", err.message);
      }
    }

    await logActivity({
      actor: req.user,
      action: "user.created",
      summary: `Created ${role} account for ${fullName} (${email})`,
      targetType: "user",
      targetId: user._id,
      targetLabel: fullName,
    });

    return res.status(201).json({
      user: toUserDTO(user.toObject()),
      emailDelivered: delivered,
      loginUrl: loginUrlFor(role),
      // Returned so the admin can pass it on when email delivery is unavailable.
      ...(password ? {} : { generatedPassword: plainPassword }),
    });
  } catch (err) {
    return next(err);
  }
};

const EDITABLE = [
  "fullName", "phone", "location", "institution",
  "educationLevel", "fieldOfStudy", "sex", "bio",
];

export const updateUser = async (req, res, next) => {
  try {
    const updates = {};
    EDITABLE.forEach((f) => {
      if (f in (req.body || {})) updates[f] = req.body[f];
    });

    if (req.body?.email) {
      const email = String(req.body.email).toLowerCase().trim();
      if (!isValidEmail(email)) {
        return res.status(400).json(formatError("VALIDATION_ERROR", "Invalid email format"));
      }
      const clash = await User.findOne({ email, _id: { $ne: req.params.userId } });
      if (clash) return res.status(409).json(formatError("EMAIL_EXISTS", "Another account already uses that email"));
      updates.email = email;
    }

    if (req.body?.role) {
      if (!ROLES.includes(req.body.role)) {
        return res.status(400).json(formatError("VALIDATION_ERROR", "Invalid role"));
      }
      if (String(req.params.userId) === String(req.user.userId) && req.body.role !== "admin") {
        return res.status(400).json(formatError("VALIDATION_ERROR", "You cannot remove your own admin role"));
      }
      updates.role = req.body.role;
    }

    if (updates.educationLevel && !EDUCATION_LEVELS.includes(updates.educationLevel)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Invalid education level"));
    }
    if (updates.sex && !SEX_OPTIONS.includes(updates.sex)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Invalid sex value"));
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "No editable fields supplied"));
    }

    const user = await User.findByIdAndUpdate(req.params.userId, updates, { new: true, runValidators: true }).lean();
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));

    await logActivity({
      actor: req.user,
      action: "user.updated",
      summary: `Updated ${Object.keys(updates).join(", ")} for ${user.fullName}`,
      targetType: "user",
      targetId: user._id,
      targetLabel: user.fullName,
    });

    return res.json({ user: toUserDTO(user) });
  } catch (err) {
    return next(err);
  }
};

export const setUserPassword = async (req, res, next) => {
  try {
    const { password, sendEmail = false } = req.body || {};
    if (password && String(password).length < 6) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Password must be at least 6 characters"));
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));

    const plainPassword = password || generatePassword();
    user.passwordHash = await bcrypt.hash(plainPassword, 10);
    // A password reset ends every existing session for that account.
    user.refreshTokens = [];
    await user.save();

    let delivered = false;
    if (sendEmail) {
      try {
        const result = await sendAccountCredentialsEmail({
          to: user.email,
          fullName: user.fullName,
          password: plainPassword,
          role: user.role,
          loginUrl: loginUrlFor(user.role),
        });
        delivered = result.delivered;
      } catch (err) {
        console.warn("Could not email new password:", err.message);
      }
    }

    await logActivity({
      actor: req.user,
      action: "user.password_reset",
      summary: `Set a new password for ${user.fullName} (${user.email})`,
      targetType: "user",
      targetId: user._id,
      targetLabel: user.fullName,
    });

    return res.json({
      success: true,
      emailDelivered: delivered,
      ...(password ? {} : { generatedPassword: plainPassword }),
    });
  } catch (err) {
    return next(err);
  }
};

export const setUserStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body || {};
    if (typeof isActive !== "boolean") {
      return res.status(400).json(formatError("VALIDATION_ERROR", "isActive must be true or false"));
    }
    if (String(req.params.userId) === String(req.user.userId) && !isActive) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "You cannot deactivate your own account"));
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));

    // Refuse to lock everyone out of the admin area.
    if (!isActive && user.role === "admin") {
      const activeAdmins = await User.countDocuments({ role: "admin", isActive: { $ne: false } });
      if (activeAdmins <= 1) {
        return res.status(400).json(formatError("VALIDATION_ERROR", "At least one admin must stay active"));
      }
    }

    user.isActive = isActive;
    if (!isActive) user.refreshTokens = [];
    await user.save();

    await logActivity({
      actor: req.user,
      action: isActive ? "user.activated" : "user.deactivated",
      summary: `${isActive ? "Activated" : "Deactivated"} ${user.fullName} (${user.email})`,
      targetType: "user",
      targetId: user._id,
      targetLabel: user.fullName,
    });

    return res.json({ user: toUserDTO(user.toObject()) });
  } catch (err) {
    return next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Invalid user id"));
    }
    if (String(userId) === String(req.user.userId)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "You cannot delete your own account"));
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));

    if (user.role === "admin") {
      const activeAdmins = await User.countDocuments({ role: "admin", isActive: { $ne: false } });
      if (activeAdmins <= 1) {
        return res.status(400).json(formatError("VALIDATION_ERROR", "At least one admin must remain"));
      }
    }

    const regResult = await EventRegistration.deleteMany({ userId });
    await Event.updateMany({ photographers: userId }, { $pull: { photographers: userId } });
    const { fullName, email, role } = user;
    await user.deleteOne();

    await logActivity({
      actor: req.user,
      action: "user.deleted",
      summary: `Deleted ${role} account for ${fullName} (${email})`,
      targetType: "user",
      targetId: userId,
      targetLabel: fullName,
    });

    return res.json({ success: true, deleted: { registrations: regResult.deletedCount } });
  } catch (err) {
    return next(err);
  }
};

export default {
  listUsers,
  getUser,
  createUser,
  updateUser,
  setUserPassword,
  setUserStatus,
  deleteUser,
};
