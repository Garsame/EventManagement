import crypto from "crypto";
import Event, { canRegisterFor } from "../models/Event.js";
import EventRegistration from "../models/EventRegistration.js";
import Media from "../models/Media.js";
import User, { missingProfileFields } from "../models/User.js";

const formatError = (code, message) => ({ error: { code, message } });

const toMediaDTO = (doc) => ({
  id: doc._id,
  eventId: doc.eventId,
  url: doc.url,
  thumbnailUrl: doc.thumbnailUrl,
  type: doc.type,
  caption: doc.caption,
  createdAt: doc.createdAt,
});

const generateRegistrationCode = () => `EVT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
const generateQrToken = () => crypto.randomBytes(32).toString("hex");

export const registerForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));

    // Drafts and completed events are not taking registrations.
    if (!canRegisterFor(event)) {
      return res.status(403).json(
        formatError(
          "REGISTRATION_CLOSED",
          event.status === "completed"
            ? "This event has finished, so registration is closed."
            : "Registration is not open for this event yet."
        )
      );
    }

    // Organisers need a full profile on file before anyone takes a place, so
    // this is enforced here rather than only in the UI.
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json(formatError("NOT_FOUND", "User not found"));

    const missing = missingProfileFields(user);
    if (missing.length > 0) {
      return res.status(403).json({
        error: {
          code: "PROFILE_INCOMPLETE",
          message: "Complete your profile before registering for an event.",
          missingProfileFields: missing,
        },
      });
    }

    let registration = await EventRegistration.findOne({ eventId, userId });
    if (registration) {
      return res.json({ registration });
    }

    registration = await EventRegistration.create({
      eventId,
      userId,
      registrationCode: generateRegistrationCode(),
      qrToken: generateQrToken(),
      attended: false,
    });

    return res.status(201).json({ registration });
  } catch (err) {
    return next(err);
  }
};

export const getMyRegistration = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;
    const registration = await EventRegistration.findOne({ eventId, userId }).lean();
    if (!registration) {
      return res.status(404).json(formatError("NOT_REGISTERED", "No registration for this event"));
    }
    return res.json({ registration });
  } catch (err) {
    return next(err);
  }
};

export const checkIn = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { registrationCode, qrToken } = req.body || {};
    if (!registrationCode && !qrToken) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "registrationCode or qrToken is required"));
    }

    const query = { eventId };
    if (registrationCode) query.registrationCode = registrationCode;
    if (qrToken) query.qrToken = qrToken;

    const registration = await EventRegistration.findOne(query);
    if (!registration) {
      return res.status(404).json(formatError("NOT_REGISTERED", "Registration not found for this event/code"));
    }

    if (registration.attended) {
      return res.json({ registration });
    }

    registration.attended = true;
    registration.checkedInAt = new Date();
    registration.checkedInBy = req.user.userId;
    await registration.save();

    return res.json({ registration });
  } catch (err) {
    return next(err);
  }
};

export const galleryGate = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;
    const registration = await EventRegistration.findOne({ eventId, userId }).lean();
    if (!registration) {
      return res.status(403).json(formatError("NOT_REGISTERED", "Please register first"));
    }
    if (!registration.attended) {
      return res.status(403).json(formatError("NOT_ATTENDED", "You must check-in at the event to view media"));
    }
    const media = await Media.find({ eventId }).sort({ createdAt: -1 }).lean();
    return res.json({ media: media.map(toMediaDTO) });
  } catch (err) {
    return next(err);
  }
};

export default {
  registerForEvent,
  getMyRegistration,
  checkIn,
  galleryGate,
};
