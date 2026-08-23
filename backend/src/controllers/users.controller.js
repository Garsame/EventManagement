import User, { toUserDTO } from "../models/User.js";
import EventRegistration from "../models/EventRegistration.js";
import Media from "../models/Media.js";
import { isStorageReady, removeMedia, storeMedia } from "../config/storage.js";
import {
  MIN_AGE_YEARS,
  latestAllowedBirthDate,
  validateProfile,
} from "../utils/profileValidation.js";

const formatError = (code, message) => ({ error: { code, message } });

// Only these may be written through the profile endpoint. Role, email and
// password deliberately are not editable here.
const EDITABLE_FIELDS = [
  "fullName",
  "phone",
  "location",
  "institution",
  "educationLevel",
  "fieldOfStudy",
  "sex",
  "dateOfBirth",
  "bio",
];

// Re-exported so existing importers keep working; the rules themselves now
// live in utils/profileValidation.js, shared with signup.
export { MIN_AGE_YEARS, latestAllowedBirthDate };

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId).lean();
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));
    return res.json({ user: toUserDTO(user) });
  } catch (err) {
    return next(err);
  }
};

export const updateMe = async (req, res, next) => {
  try {
    const updates = {};
    for (const field of EDITABLE_FIELDS) {
      if (field in (req.body || {})) updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "No editable fields supplied"));
    }

    const fieldErrors = validateProfile(updates);
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: Object.values(fieldErrors)[0],
          // Per field, so the form can put each message under its own input.
          fields: fieldErrors,
        },
      });
    }

    if ("dateOfBirth" in updates) {
      updates.dateOfBirth = updates.dateOfBirth ? new Date(updates.dateOfBirth) : null;
    }

    const user = await User.findByIdAndUpdate(req.user.userId, updates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));
    return res.json({ user: toUserDTO(user) });
  } catch (err) {
    return next(err);
  }
};

export const uploadAvatar = async (req, res, next) => {
  try {
    if (!isStorageReady) {
      return res.status(503).json(formatError("MEDIA_STORAGE_UNCONFIGURED", "Media storage is not configured"));
    }
    if (!req.file) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "file is required"));
    }
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Avatar must be an image"));
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));

    const stored = await storeMedia(req.file.buffer, {
      eventId: `avatars/${user._id}`,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    // Drop the previous image so avatars do not pile up on disk.
    if (user.avatarPublicId) {
      try {
        await removeMedia(user.avatarPublicId, "image");
      } catch (err) {
        console.warn("Could not remove previous avatar", err.message);
      }
    }

    user.avatarUrl = stored.url;
    user.avatarPublicId = stored.publicId;
    await user.save();

    return res.status(201).json({ user: toUserDTO(user.toObject()) });
  } catch (err) {
    return next(err);
  }
};

export const deleteAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));

    if (user.avatarPublicId) {
      try {
        await removeMedia(user.avatarPublicId, "image");
      } catch (err) {
        console.warn("Could not remove avatar file", err.message);
      }
    }

    user.avatarUrl = "";
    user.avatarPublicId = "";
    await user.save();

    return res.json({ user: toUserDTO(user.toObject()) });
  } catch (err) {
    return next(err);
  }
};

/**
 * Every event this user registered for, with the stage they have reached.
 * Powers both the dashboard overview and the Your Events list.
 */
export const getMyRegistrations = async (req, res, next) => {
  try {
    const registrations = await EventRegistration.find({ userId: req.user.userId })
      .populate("eventId")
      .sort({ registeredAt: -1 })
      .lean();

    // One grouped count query rather than a lookup per event.
    const eventIds = registrations.filter((r) => r.eventId).map((r) => r.eventId._id);
    const mediaCounts = await Media.aggregate([
      { $match: { eventId: { $in: eventIds } } },
      { $group: { _id: "$eventId", count: { $sum: 1 } } },
    ]);
    const countByEvent = new Map(mediaCounts.map((m) => [String(m._id), m.count]));

    const now = new Date();
    const items = registrations
      // A deleted event leaves an orphan registration; skip rather than crash.
      .filter((reg) => reg.eventId)
      .map((reg) => {
        const event = reg.eventId;
        const mediaCount = countByEvent.get(String(event._id)) || 0;
        const hasEnded = new Date(event.endDateTime) < now;

        const approvalStatus = reg.approvalStatus || "pending";

        // Approval sits between requesting a place and turning up for it, so
        // a guest can see they are waiting on the organiser rather than on
        // the day of the event.
        let stage = approvalStatus === "approved" ? "approved" : "requested";
        if (reg.attended && mediaCount > 0) stage = "gallery-ready";
        else if (reg.attended) stage = "checked-in";

        return {
          registrationId: reg._id,
          // Codes exist only once approved, and are withheld otherwise so an
          // unapproved guest has nothing to show at the door.
          registrationCode: approvalStatus === "approved" ? reg.registrationCode : "",
          qrToken: approvalStatus === "approved" ? reg.qrToken : "",
          approvalStatus,
          decidedAt: reg.decidedAt || null,
          decisionNote: reg.decisionNote || "",
          attended: reg.attended,
          registeredAt: reg.registeredAt,
          checkedInAt: reg.checkedInAt || null,
          stage,
          mediaCount,
          hasEnded,
          planName: reg.planName || "",
          amountDue: reg.amountDue ?? null,
          currency: reg.currency || "",
          paymentStatus: reg.paymentStatus,
          event: {
            id: event._id,
            title: event.title,
            description: event.description,
            location: event.location,
            startDateTime: event.startDateTime,
            endDateTime: event.endDateTime,
            published: event.published,
            visibility: event.visibility,
            isPremium: event.isPremium,
          },
        };
      });

    const stats = {
      total: items.length,
      attended: items.filter((i) => i.attended).length,
      pending: items.filter((i) => !i.attended && !i.hasEnded).length,
      awaitingApproval: items.filter((i) => i.approvalStatus === "pending" && !i.hasEnded).length,
      approved: items.filter((i) => i.approvalStatus === "approved").length,
      rejected: items.filter((i) => i.approvalStatus === "rejected").length,
      missed: items.filter((i) => !i.attended && i.hasEnded).length,
      galleriesAvailable: items.filter((i) => i.stage === "gallery-ready").length,
      photosAvailable: items
        .filter((i) => i.attended)
        .reduce((sum, i) => sum + i.mediaCount, 0),
      upcoming: items.filter((i) => !i.hasEnded).length,
    };

    return res.json({ registrations: items, stats });
  } catch (err) {
    return next(err);
  }
};

export default {
  getMe,
  updateMe,
  uploadAvatar,
  deleteAvatar,
  getMyRegistrations,
};
