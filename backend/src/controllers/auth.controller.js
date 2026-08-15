import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User, { toUserDTO } from "../models/User.js";
import { signAccessToken, signRefreshToken } from "../utils/token.js";

const formatError = (code, message) => ({ error: { code, message } });

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);
const isValidPassword = (pwd) => typeof pwd === "string" && pwd.length >= 6;

export const register = async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body || {};
    if (!fullName || !email || !password) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "fullName, email, and password are required"));
    }
    if (!isValidEmail(email)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Invalid email format"));
    }
    if (!isValidPassword(password)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Password must be at least 6 characters"));
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json(formatError("EMAIL_EXISTS", "Email is already registered"));
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      passwordHash,
      role: "attendee",
      refreshTokens: [],
    });

    return res.status(201).json({ user: toUserDTO(user.toObject()) });
  } catch (err) {
    return next(err);
  }
};

/**
 * Each sign-in door only opens for its own roles. An admin cannot sign in on
 * the public form even with correct credentials, and vice versa, so the realms
 * stay genuinely separate rather than merely hidden in the UI.
 */
const loginForRoles = (allowedRoles) => async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "email and password are required"));
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json(formatError("INVALID_CREDENTIALS", "Invalid email or password"));
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json(formatError("INVALID_CREDENTIALS", "Invalid email or password"));
    }

    // Same wording as a bad password, so this form never reveals that an
    // address exists under a different role.
    if (!allowedRoles.includes(user.role)) {
      return res.status(401).json(formatError("INVALID_CREDENTIALS", "Invalid email or password"));
    }

    if (user.isActive === false) {
      return res.status(403).json(
        formatError("ACCOUNT_DEACTIVATED", "This account has been deactivated. Contact an administrator.")
      );
    }

    user.lastLoginAt = new Date();

    const accessToken = signAccessToken({ userId: user._id, role: user.role, email: user.email });
    const refreshToken = signRefreshToken({ userId: user._id, role: user.role, email: user.email });

    user.refreshTokens.push(refreshToken);
    await user.save();

    return res.json({
      user: toUserDTO(user.toObject()),
      accessToken,
      refreshToken,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Bootstraps the very first admin account. Once one admin exists, every
 * further admin must be created from inside the admin dashboard by an
 * existing admin - this route then refuses, so it cannot be used to mint
 * arbitrary admins later.
 */
export const adminExists = async (req, res, next) => {
  try {
    const exists = (await User.countDocuments({ role: "admin" })) > 0;
    return res.json({ exists });
  } catch (err) {
    return next(err);
  }
};

export const adminSignup = async (req, res, next) => {
  try {
    if ((await User.countDocuments({ role: "admin" })) > 0) {
      return res.status(403).json(
        formatError("ADMIN_EXISTS", "An administrator account already exists. Ask an existing admin to create your account.")
      );
    }

    const { fullName, password } = req.body || {};
    const email = String(req.body?.email || "").toLowerCase().trim();
    if (!fullName || !email || !password) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "fullName, email, and password are required"));
    }
    if (!isValidEmail(email)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Invalid email format"));
    }
    if (!isValidPassword(password)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Password must be at least 6 characters"));
    }
    if (await User.findOne({ email })) {
      return res.status(409).json(formatError("EMAIL_EXISTS", "Email is already registered"));
    }

    const user = await User.create({
      fullName,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "admin",
      isActive: true,
      refreshTokens: [],
    });

    const accessToken = signAccessToken({ userId: user._id, role: user.role, email: user.email });
    const refreshToken = signRefreshToken({ userId: user._id, role: user.role, email: user.email });
    user.refreshTokens.push(refreshToken);
    user.lastLoginAt = new Date();
    await user.save();

    return res.status(201).json({ user: toUserDTO(user.toObject()), accessToken, refreshToken });
  } catch (err) {
    return next(err);
  }
};

export const login = loginForRoles(["attendee"]);
export const adminLogin = loginForRoles(["admin"]);
export const photographerLogin = loginForRoles(["photographer"]);

export const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "refreshToken is required"));
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json(formatError("INVALID_REFRESH", "Invalid or expired refresh token"));
    }

    const user = await User.findOne({ _id: decoded.sub, refreshTokens: refreshToken });
    if (!user) {
      return res.status(401).json(formatError("INVALID_REFRESH", "Refresh token not recognized"));
    }
    // Deactivating an account must end its existing sessions too.
    if (user.isActive === false) {
      user.refreshTokens = [];
      await user.save();
      return res.status(403).json(
        formatError("ACCOUNT_DEACTIVATED", "This account has been deactivated. Contact an administrator.")
      );
    }

    user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);

    const newRefreshToken = signRefreshToken({ userId: user._id, role: user.role, email: user.email });
    const accessToken = signAccessToken({ userId: user._id, role: user.role, email: user.email });

    user.refreshTokens.push(newRefreshToken);
    await user.save();

    return res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "refreshToken is required"));
    }

    const user = await User.findOne({ refreshTokens: refreshToken });
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((t) => t !== refreshToken);
      await user.save();
    }

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export default {
  register,
  login,
  refresh,
  logout,
};
