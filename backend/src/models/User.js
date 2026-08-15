import mongoose from "mongoose";

export const EDUCATION_LEVELS = [
  "high-school",
  "certificate",
  "diploma",
  "bachelors",
  "masters",
  "doctorate",
  "other",
];

export const SEX_OPTIONS = ["female", "male", "prefer-not-to-say"];

// Everything an event organiser needs on file before a guest can register.
// fieldOfStudy is deliberately excluded - it does not apply to everyone.
export const REQUIRED_PROFILE_FIELDS = [
  "phone",
  "location",
  "institution",
  "educationLevel",
  "sex",
];

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "photographer", "attendee"], default: "attendee" },
  // Deactivated accounts keep their data but cannot sign in.
  isActive: { type: Boolean, default: true },
  // Set when an admin creates the account rather than the user signing up.
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  lastLoginAt: { type: Date, default: null },

  // Profile completed after signup. Registration for an event is blocked until
  // every field in REQUIRED_PROFILE_FIELDS is filled in.
  phone: { type: String, trim: true, default: "" },
  location: { type: String, trim: true, default: "" },
  institution: { type: String, trim: true, default: "" },
  educationLevel: { type: String, enum: [...EDUCATION_LEVELS, ""], default: "" },
  fieldOfStudy: { type: String, trim: true, default: "" },
  sex: { type: String, enum: [...SEX_OPTIONS, ""], default: "" },
  dateOfBirth: { type: Date, default: null },
  bio: { type: String, trim: true, default: "", maxlength: 500 },
  avatarUrl: { type: String, default: "" },
  avatarPublicId: { type: String, default: "" },

  refreshTokens: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export const missingProfileFields = (user) =>
  REQUIRED_PROFILE_FIELDS.filter((field) => {
    const value = user?.[field];
    return value === undefined || value === null || String(value).trim() === "";
  });

export const isProfileComplete = (user) => missingProfileFields(user).length === 0;

/** Shape sent to the client. Never includes passwordHash or refreshTokens. */
export const toUserDTO = (user) => {
  const missing = missingProfileFields(user);
  const [firstName = "", ...rest] = String(user.fullName || "").trim().split(/\s+/);
  return {
    id: user._id,
    fullName: user.fullName,
    firstName,
    lastName: rest.join(" "),
    // Two letters for the avatar fallback when no image has been uploaded.
    initials: `${firstName[0] || ""}${(rest[rest.length - 1] || "")[0] || ""}`.toUpperCase(),
    email: user.email,
    role: user.role,
    isActive: user.isActive !== false,
    lastLoginAt: user.lastLoginAt || null,
    phone: user.phone || "",
    location: user.location || "",
    institution: user.institution || "",
    educationLevel: user.educationLevel || "",
    fieldOfStudy: user.fieldOfStudy || "",
    sex: user.sex || "",
    dateOfBirth: user.dateOfBirth || null,
    bio: user.bio || "",
    avatarUrl: user.avatarUrl || "",
    profileComplete: missing.length === 0,
    missingProfileFields: missing,
    createdAt: user.createdAt,
  };
};

export default mongoose.model("User", userSchema);
