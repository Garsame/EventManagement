import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
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

    return res.status(201).json({
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    return next(err);
  }
};

export const login = async (req, res, next) => {
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

    const accessToken = signAccessToken({ userId: user._id, role: user.role, email: user.email });
    const refreshToken = signRefreshToken({ userId: user._id, role: user.role, email: user.email });

    user.refreshTokens.push(refreshToken);
    await user.save();

    return res.json({
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    return next(err);
  }
};

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
