import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "photographer", "attendee"], default: "attendee" },
  refreshTokens: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("User", userSchema);
