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

/**
 * Step 1 of password recovery for someone who is locked out entirely (as
 * opposed to requestPasswordOtp above, which is the in-account self-service
 * change for someone who is already signed in). Deliberately realm-agnostic:
 * whoever owns the email gets the code, regardless of whether they arrived
 * from the attendee, admin, or photographer login page - the frontend page
 * just needs to know which login path to send them back to afterward.
 *
 * The response is identical whether or not the email is registered, so this
 * endpoint can't be used to test which addresses have accounts.
 */
export const forgotPasswordRequest = async (req, res, next) => {
  try {
    const email = normalise(req.body?.email);
    if (!email || !isValidEmail(email)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "A valid email is required"));
    }

    const user = await User.findOne({ email });
    let devCode;

    if (user) {
      await Otp.deleteMany({ email, purpose: "password-reset" });
      const code = generateCode();
      await Otp.create({
        email,
        purpose: "password-reset",
        codeHash: hashCode(code),
        payload: { userId: user._id },
        expiresAt: expiryDate(),
      });
      try {
        const result = await sendOtpEmail({ to: email, code, purpose: "password-reset" });
        devCode = result.devCode;
      } catch (err) {
        console.warn("Could not send password-reset email:", err.message);
      }
    }

    return res.json({
      message: "If that email is registered, a reset code has been sent to it.",
      expiresInMinutes: OTP_TTL_MINUTES,
      // Only ever present when SMTP is unconfigured (local dev). This does
      // mean the key's presence leaks whether the account exists in that one
      // no-mail-configured case; every deployment with real email sending
      // never has this field at all, which is the case that actually matters.
      ...(devCode ? { devCode } : {}),
    });
  } catch (err) {
    return next(err);
  }
};

/** Step 2: verify the code and set a new password. No session is issued -
 * the caller does not know which realm's login to authenticate into, so it
 * sends the user back to sign in normally instead. */
export const forgotPasswordVerify = async (req, res, next) => {
  try {
    const email = normalise(req.body?.email);
    const { code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "email, code, and newPassword are required"));
    }
    if (!isValidPassword(newPassword)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Password must be at least 6 characters"));
    }

    const otp = await Otp.findOne({ email, purpose: "password-reset" });
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

    const user = await User.findById(otp.payload.userId);
    if (!user) {
      await otp.deleteOne();
      return res.status(404).json(formatError("NOT_FOUND", "That account no longer exists"));
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    // A password only an attacker with mailbox access could have reset
    // should not leave a legitimate session standing either way - end them all.
    user.refreshTokens = [];
    await user.save();
    await otp.deleteOne();

    return res.json({ success: true });
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
  forgotPasswordRequest,
  forgotPasswordVerify,
};
