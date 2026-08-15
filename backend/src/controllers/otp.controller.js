import bcrypt from "bcrypt";
import User, { toUserDTO } from "../models/User.js";
import Otp, {
  MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  codeMatches,
  expiryDate,
  generateCode,
  hashCode,
} from "../models/Otp.js";
import { sendOtpEmail } from "../config/mailer.js";
import { signAccessToken, signRefreshToken } from "../utils/token.js";

const formatError = (code, message) => ({ error: { code, message } });

const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);
const isValidPassword = (pwd) => typeof pwd === "string" && pwd.length >= 6;
const normalise = (email) => String(email || "").toLowerCase().trim();

const issueSession = async (user) => {
  const accessToken = signAccessToken({ userId: user._id, role: user.role, email: user.email });
  const refreshToken = signRefreshToken({ userId: user._id, role: user.role, email: user.email });
  user.refreshTokens.push(refreshToken);
  await user.save();
  return { accessToken, refreshToken };
};

/**
 * Step 1 of signup. Holds the account details against a one-time code and
 * emails it. No User document is created until the code is verified, so
 * cancelling leaves nothing behind.
 */
export const requestSignupOtp = async (req, res, next) => {
  try {
    const { fullName, password } = req.body || {};
    const email = normalise(req.body?.email);

    if (!fullName || !email || !password) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "fullName, email, and password are required"));
    }
    if (!isValidEmail(email)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Invalid email format"));
    }
    if (!isValidPassword(password)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Password must be at least 6 characters"));
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json(formatError("EMAIL_EXISTS", "Email is already registered"));
    }

    // One live code per email and purpose.
    await Otp.deleteMany({ email, purpose: "signup" });

    const code = generateCode();
    await Otp.create({
      email,
      purpose: "signup",
      codeHash: hashCode(code),
      payload: { fullName, passwordHash: await bcrypt.hash(password, 10) },
      expiresAt: expiryDate(),
    });

    const result = await sendOtpEmail({ to: email, code, purpose: "signup" });

    return res.status(201).json({
      email,
      expiresInMinutes: OTP_TTL_MINUTES,
      delivered: result.delivered,
      // Only present when SMTP is unconfigured, so local testing still works.
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (err) {
    return next(err);
  }
};

/** Cancel button: drop the pending signup entirely. */
export const cancelSignupOtp = async (req, res, next) => {
  try {
    const email = normalise(req.body?.email);
    if (!email) return res.status(400).json(formatError("VALIDATION_ERROR", "email is required"));
    await Otp.deleteMany({ email, purpose: "signup" });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

/** Step 2 of signup: correct code creates the account and signs them straight in. */
export const verifySignupOtp = async (req, res, next) => {
  try {
    const email = normalise(req.body?.email);
    const { code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "email and code are required"));
    }

    const otp = await Otp.findOne({ email, purpose: "signup" });
    if (!otp || otp.expiresAt < new Date()) {
      return res.status(400).json(formatError("OTP_EXPIRED", "That code has expired. Request a new one."));
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json(formatError("OTP_ATTEMPTS_EXCEEDED", "Too many incorrect attempts. Request a new code."));
    }
    if (!codeMatches(code, otp.codeHash)) {
      otp.attempts += 1;
      await otp.save();
      return res.status(400).json({
        error: {
          code: "OTP_INVALID",
          message: "Wrong OTP. Check the code in your email and try again.",
          attemptsLeft: Math.max(0, MAX_ATTEMPTS - otp.attempts),
        },
      });
    }

    // Guard against the address being claimed while the code was outstanding.
    if (await User.findOne({ email })) {
      await otp.deleteOne();
      return res.status(409).json(formatError("EMAIL_EXISTS", "Email is already registered"));
    }

    const user = await User.create({
      fullName: otp.payload.fullName,
      email,
      passwordHash: otp.payload.passwordHash,
      role: "attendee",
      refreshTokens: [],
    });
    await otp.deleteOne();

    const tokens = await issueSession(user);
    return res.status(201).json({ user: toUserDTO(user.toObject()), ...tokens });
  } catch (err) {
    return next(err);
  }
};

/** Emails a code to the signed-in user so they can change their password. */
export const requestPasswordOtp = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));

    await Otp.deleteMany({ email: user.email, purpose: "password-reset" });

    const code = generateCode();
    await Otp.create({
      email: user.email,
      purpose: "password-reset",
      codeHash: hashCode(code),
      payload: { userId: user._id },
      expiresAt: expiryDate(),
    });

    const result = await sendOtpEmail({ to: user.email, code, purpose: "password-reset" });

    return res.json({
      email: user.email,
      expiresInMinutes: OTP_TTL_MINUTES,
      delivered: result.delivered,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (err) {
    return next(err);
  }
};

/** Verifies the code and sets the new password, ending all other sessions. */
export const changePasswordWithOtp = async (req, res, next) => {
  try {
    const { code, newPassword } = req.body || {};
    if (!code || !newPassword) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "code and newPassword are required"));
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Password must be at least 6 characters"));
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));

    const otp = await Otp.findOne({ email: user.email, purpose: "password-reset" });
    if (!otp || otp.expiresAt < new Date()) {
      return res.status(400).json(formatError("OTP_EXPIRED", "That code has expired. Request a new one."));
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json(formatError("OTP_ATTEMPTS_EXCEEDED", "Too many incorrect attempts. Request a new code."));
    }
    if (!codeMatches(code, otp.codeHash)) {
      otp.attempts += 1;
      await otp.save();
      return res.status(400).json({
        error: {
          code: "OTP_INVALID",
          message: "Wrong OTP. Check the code in your email and try again.",
          attemptsLeft: Math.max(0, MAX_ATTEMPTS - otp.attempts),
        },
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    // A password change should log out anyone else holding a refresh token.
    user.refreshTokens = [];
    await user.save();
    await otp.deleteOne();

    const tokens = await issueSession(user);
    return res.json({ success: true, ...tokens });
  } catch (err) {
    return next(err);
  }
};

export default {
  requestSignupOtp,
  cancelSignupOtp,
  verifySignupOtp,
  requestPasswordOtp,
  changePasswordWithOtp,
};
