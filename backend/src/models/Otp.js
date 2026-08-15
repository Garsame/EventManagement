import crypto from "crypto";
import mongoose from "mongoose";

export const OTP_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  purpose: { type: String, enum: ["signup", "password-reset"], required: true },
  // Only the hash is stored, so a database leak does not expose live codes.
  codeHash: { type: String, required: true },
  // Signup holds the pending account here; no User row exists until verified.
  payload: {
    fullName: String,
    passwordHash: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Mongo removes the document once it expires, so stale codes cannot be reused.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, purpose: 1 });

export const generateCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

export const hashCode = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

/** Constant-time compare so a wrong code cannot be found by timing. */
export const codeMatches = (code, storedHash) => {
  const a = Buffer.from(hashCode(code));
  const b = Buffer.from(storedHash || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const expiryDate = () => new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

export default mongoose.model("Otp", otpSchema);
