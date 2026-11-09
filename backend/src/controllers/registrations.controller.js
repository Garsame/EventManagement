import Event, { canRegisterFor } from "../models/Event.js";
import EventRegistration from "../models/EventRegistration.js";
import Media from "../models/Media.js";
import User, { missingProfileFields } from "../models/User.js";
import { logActivity } from "../utils/activityLog.js";

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

/**
 * What the guest is allowed to see of their own registration. The codes are
 * omitted entirely until an admin approves, so a pending or rejected guest has
 * nothing to present - the door check is not the only thing standing between
 * them and entry.
 */
const toMyRegistrationDTO = (r) => {
  const base = {
    id: r._id,
    eventId: r.eventId,
    registeredAt: r.registeredAt,
    approvalStatus: r.approvalStatus || "pending",
    decidedAt: r.decidedAt || null,
    decisionNote: r.decisionNote || "",
    attended: r.attended,
    checkedInAt: r.checkedInAt || null,
    planName: r.planName || "",
    amountDue: r.amountDue ?? null,
    currency: r.currency || "",
    paymentStatus: r.paymentStatus,
    paymentReference: r.paymentReference || "",
  };
  if (r.approvalStatus !== "approved") return base;
  return { ...base, registrationCode: r.registrationCode, qrToken: r.qrToken };
};

export const registerForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;
    const { planId, paymentReference } = req.body || {};

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
      return res.json({ registration: toMyRegistrationDTO(registration) });
    }

    // Premium events require a plan choice up front; it is snapshotted onto
    // the registration so later edits to the event's plans can't change what
    // this guest already committed (and, once paid, already paid) to.
    let planFields = {};
    if (event.isPremium) {
      const plan = (event.plans || []).find((p) => String(p._id) === String(planId));
      if (!plan) {
        return res.status(400).json(formatError("VALIDATION_ERROR", "Choose a valid participation plan"));
      }
      planFields = {
        planId: plan._id,
        planName: plan.name,
        amountDue: plan.price,
        currency: event.currency || "USD",
        paymentStatus: "pending",
        paymentMethod: "manual",
        paymentReference: (paymentReference || "").trim(),
      };
    }

    // No codes yet. A registration starts as a request; an admin decides, and
    // approval is what issues the code and QR token.
    registration = await EventRegistration.create({
      eventId,
      userId,
      approvalStatus: "pending",
      attended: false,
      ...planFields,
    });

    await logActivity({
      actor: { userId, role: req.user.role, email: req.user.email },
      action: "registration.requested",
      summary: `${user.fullName} requested a place at "${event.title}"`,
      targetType: "registration",
      targetId: registration._id,
      targetLabel: user.fullName,
    });

    return res.status(201).json({ registration: toMyRegistrationDTO(registration) });
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
    return res.json({ registration: toMyRegistrationDTO(registration) });
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

    // The door has to be explicitly opened by an admin before anyone can be
    // checked in - enforced here, not just hidden in the console UI, so the
    // API itself refuses a scan against a closed event.
    const event = await Event.findById(eventId).select("title checkInOpen isPremium").lean();
    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));
    if (!event.checkInOpen) {
      return res.status(403).json(formatError("CHECKIN_CLOSED", "Check-in is not open for this event yet."));
    }

    const query = { eventId };
    // A blank code must never match the many registrations that legitimately
    // hold none, so an unapproved guest's "empty" code cannot open the door.
    if (registrationCode) query.registrationCode = String(registrationCode).trim();
    if (qrToken) query.qrToken = String(qrToken).trim();
    if (!query.registrationCode && !query.qrToken) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "registrationCode or qrToken is required"));
    }

    const registration = await EventRegistration.findOne(query);
    if (!registration) {
      // Covers a forged QR, a code from a different event, and a code that was
      // revoked when its registration was rejected - all indistinguishable
      // from the door's point of view, and all refused.
      return res.status(404).json(
        formatError("INVALID_CODE", "That code is not valid for this event. Ask the guest to check their approval email.")
      );
    }

    // Approval is the actual permission to attend; the code is only how it is
    // presented. Re-checked here so a code issued and then revoked is refused.
    if (registration.approvalStatus !== "approved") {
      const guestName = (await User.findById(registration.userId).select("fullName").lean())?.fullName;
      return res.status(403).json(
        formatError(
          "NOT_APPROVED",
          registration.approvalStatus === "rejected"
            ? `${guestName || "This guest"}'s registration was not approved for this event.`
            : `${guestName || "This guest"}'s registration is still awaiting approval.`
        )
      );
    }

    // A premium guest cannot be let in until an admin has confirmed their
    // payment - this is the actual enforcement of the participation fee.
    if (event.isPremium && registration.paymentStatus !== "paid") {
      return res.status(403).json(
        formatError("PAYMENT_REQUIRED", "This guest's payment has not been confirmed yet. Confirm payment before checking them in.")
      );
    }

    // Fetched once and returned alongside the registration in both branches
    // below, so the check-in desk can show who it just scanned rather than
    // only a bare code - kept as a separate `guest` field rather than
    // populating `registration.userId` so that field's existing shape (a
    // plain id) never changes for other callers.
    const guest = await User.findById(registration.userId).select("fullName email").lean();
    const guestDTO = guest ? { fullName: guest.fullName, email: guest.email } : null;

    // Once used, a registration/QR code is spent - scanning it again is
    // refused rather than silently re-confirmed, so the desk can never wave
    // the same guest through twice without noticing.
    if (registration.attended) {
      return res.status(409).json({
        error: {
          code: "ALREADY_CHECKED_IN",
          message: `${guest?.fullName || "This guest"} was already checked in for this event.`,
        },
        registration,
        guest: guestDTO,
      });
    }

    registration.attended = true;
    registration.checkedInAt = new Date();
    registration.checkedInBy = req.user.userId;
    await registration.save();

    await logActivity({
      actor: req.user,
      action: "registration.checked_in",
      summary: `Checked in ${guest?.fullName || "a guest"} (${guest?.email || "?"}) to "${event?.title || "an event"}"`,
      targetType: "registration",
      targetId: registration._id,
      targetLabel: guest?.fullName || "",
    });

    return res.json({ registration, guest: guestDTO });
  } catch (err) {
    return next(err);
  }
};

export const galleryGate = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userId;

    // The gallery used to answer from the registration row alone, so an event
    // that was no longer there kept serving its photos. Now that trashing hides
    // an event everywhere else, it has to close the gallery too.
    const event = await Event.findById(eventId).select("_id").lean();
    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));

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
