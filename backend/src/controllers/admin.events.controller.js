import mongoose from "mongoose";
import Event, { EVENT_STATUSES } from "../models/Event.js";
import User from "../models/User.js";
import Media from "../models/Media.js";
import EventRegistration from "../models/EventRegistration.js";
import { isStorageReady, removeMedia, storeMedia } from "../config/storage.js";
import { logActivity } from "../utils/activityLog.js";

const formatError = (code, message) => ({ error: { code, message } });

// `published` is not in this list on purpose: the console UI only exposes
// status, and published is derived from it below rather than being settable
// independently. That derivation used to run only on create, which meant
// changing an event from draft to registration-open through the edit modal
// never flipped published - the event stayed invisible on the public site
// even though its status said otherwise. Deriving it here on every save,
// whenever status is part of the payload, closes that gap for updates too.
const validateEventPayload = (body, isUpdate = false) => {
  const allowed = [
    "title",
    "description",
    "location",
    "startDateTime",
    "endDateTime",
    "visibility",
    "status",
    "isPremium",
    "currency",
    "plans",
  ];
  const payload = {};
  allowed.forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key];
  });
  if (payload.status && !EVENT_STATUSES.includes(payload.status)) {
    return { error: formatError("VALIDATION_ERROR", `status must be one of: ${EVENT_STATUSES.join(", ")}`) };
  }
  if (payload.visibility && !["public", "private"].includes(payload.visibility)) {
    return { error: formatError("VALIDATION_ERROR", "visibility must be public or private") };
  }
  if (payload.plans !== undefined) {
    if (!Array.isArray(payload.plans) || payload.plans.length === 0) {
      return { error: formatError("VALIDATION_ERROR", "A premium event needs at least one plan") };
    }
    const cleanPlans = [];
    for (const p of payload.plans) {
      const name = (p?.name || "").trim();
      const price = Number(p?.price);
      if (!name) return { error: formatError("VALIDATION_ERROR", "Every plan needs a name") };
      if (!Number.isFinite(price) || price < 0) {
        return { error: formatError("VALIDATION_ERROR", `Plan "${name}" needs a valid price`) };
      }
      cleanPlans.push({ name, price, description: (p?.description || "").trim() });
    }
    payload.plans = cleanPlans;
  }
  if (payload.isPremium === true && (!payload.plans || payload.plans.length === 0)) {
    return { error: formatError("VALIDATION_ERROR", "Premium events need at least one plan") };
  }
  if (!isUpdate) {
    if (!payload.title) return { error: formatError("VALIDATION_ERROR", "title is required") };
    if (!payload.startDateTime) return { error: formatError("VALIDATION_ERROR", "startDateTime is required") };
    if (!payload.endDateTime) return { error: formatError("VALIDATION_ERROR", "endDateTime is required") };
  }
  if (payload.startDateTime && payload.endDateTime) {
    if (new Date(payload.endDateTime) <= new Date(payload.startDateTime)) {
      return { error: formatError("VALIDATION_ERROR", "endDateTime must be after startDateTime") };
    }
  }
  if (!isUpdate) {
    if (!payload.visibility) payload.visibility = "public";
    if (!payload.status) payload.status = "draft";
  }
  // Keep published in lock-step with status any time status is being set,
  // on both create and update.
  if (payload.status) {
    payload.published = payload.status !== "draft";
  }
  return { payload };
};

/** Cover image for an event, stored through the same driver as event media. */
export const uploadEventCover = async (req, res, next) => {
  try {
    if (!isStorageReady) {
      return res.status(503).json(formatError("MEDIA_STORAGE_UNCONFIGURED", "Media storage is not configured"));
    }
    if (!req.file) return res.status(400).json(formatError("VALIDATION_ERROR", "file is required"));
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Cover must be an image"));
    }

    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));

    const stored = await storeMedia(req.file.buffer, {
      eventId: `covers/${event._id}`,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    if (event.coverImagePublicId) {
      try {
        await removeMedia(event.coverImagePublicId, "image");
      } catch (err) {
        console.warn("Could not remove previous cover:", err.message);
      }
    }

    event.coverImageUrl = stored.url;
    event.coverImagePublicId = stored.publicId;
    await event.save();

    return res.status(201).json({ coverImageUrl: event.coverImageUrl });
  } catch (err) {
    return next(err);
  }
};

const photographerDTO = (p) =>
  p && typeof p === "object" && p._id
    ? { id: p._id, fullName: p.fullName, email: p.email, avatarUrl: p.avatarUrl || "" }
    : { id: p };

export const createEvent = async (req, res, next) => {
  try {
    const { payload, error } = validateEventPayload(req.body);
    if (error) return res.status(400).json(error);
    const event = await Event.create({ ...payload, createdBy: req.user.userId, photographers: [] });

    await logActivity({
      actor: req.user,
      action: "event.created",
      summary: `Created event "${event.title}"`,
      targetType: "event",
      targetId: event._id,
      targetLabel: event.title,
    });

    return res.status(201).json(event);
  } catch (err) {
    return next(err);
  }
};

export const updateEvent = async (req, res, next) => {
  try {
    const { payload, error } = validateEventPayload(req.body, true);
    if (error) return res.status(400).json(error);
    const { eventId } = req.params;
    const event = await Event.findByIdAndUpdate(eventId, payload, { new: true, runValidators: true })
      .populate("photographers", "fullName email avatarUrl")
      .lean();
    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));

    await logActivity({
      actor: req.user,
      action: "event.updated",
      summary: `Updated ${Object.keys(payload).join(", ")} on "${event.title}"`,
      targetType: "event",
      targetId: event._id,
      targetLabel: event.title,
    });

    return res.json({ ...event, photographers: (event.photographers || []).map(photographerDTO) });
  } catch (err) {
    return next(err);
  }
};

/** Every event, including drafts and private ones, with counts for the table. */
export const listAllEvents = async (req, res, next) => {
  try {
    const events = await Event.find({})
      .sort({ startDateTime: 1 })
      .populate("photographers", "fullName email avatarUrl")
      .lean();

    const ids = events.map((e) => e._id);
    const [mediaCounts, regCounts] = await Promise.all([
      Media.aggregate([{ $match: { eventId: { $in: ids } } }, { $group: { _id: "$eventId", n: { $sum: 1 } } }]),
      EventRegistration.aggregate([
        { $match: { eventId: { $in: ids } } },
        {
          $group: {
            _id: "$eventId",
            total: { $sum: 1 },
            attended: { $sum: { $cond: ["$attended", 1, 0] } },
            paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
            pendingPayment: { $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0] } },
            revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amountDue", 0] } },
          },
        },
      ]),
    ]);

    const mediaBy = new Map(mediaCounts.map((m) => [String(m._id), m.n]));
    const regBy = new Map(regCounts.map((r) => [String(r._id), r]));

    return res.json({
      events: events.map((e) => {
        const reg = regBy.get(String(e._id));
        return {
          ...e,
          photographers: (e.photographers || []).map(photographerDTO),
          mediaCount: mediaBy.get(String(e._id)) || 0,
          registrationCount: reg?.total || 0,
          attendedCount: reg?.attended || 0,
          paidCount: reg?.paid || 0,
          pendingPaymentCount: reg?.pendingPayment || 0,
          revenue: reg?.revenue || 0,
        };
      }),
    });
  } catch (err) {
    return next(err);
  }
};

/** Replaces the assignment list outright; the UI sends the full set. */
export const setEventPhotographers = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { photographerIds } = req.body || {};
    if (!Array.isArray(photographerIds)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "photographerIds must be an array"));
    }
    if (photographerIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "photographerIds contains an invalid id"));
    }

    // Refuse silently-wrong assignments rather than storing ids that cannot work.
    const found = await User.find({ _id: { $in: photographerIds }, role: "photographer" }).select("_id").lean();
    if (found.length !== photographerIds.length) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "Every id must belong to a photographer account"));
    }

    const event = await Event.findByIdAndUpdate(
      eventId,
      { photographers: photographerIds },
      { new: true }
    )
      .populate("photographers", "fullName email avatarUrl")
      .lean();

    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));

    const names = (event.photographers || []).map((p) => p.fullName).join(", ") || "no one";
    await logActivity({
      actor: req.user,
      action: "event.photographers_assigned",
      summary: `Set photographers on "${event.title}" to: ${names}`,
      targetType: "event",
      targetId: event._id,
      targetLabel: event.title,
    });

    return res.json({ ...event, photographers: (event.photographers || []).map(photographerDTO) });
  } catch (err) {
    return next(err);
  }
};

/** Deletes the event plus its media files, media rows and registrations. */
export const deleteEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));

    const media = await Media.find({ eventId }).lean();
    for (const item of media) {
      try {
        await removeMedia(item.publicId, item.type);
      } catch (err) {
        console.warn(`Could not remove file for media ${item._id}:`, err.message);
      }
    }

    const [mediaResult, regResult] = await Promise.all([
      Media.deleteMany({ eventId }),
      EventRegistration.deleteMany({ eventId }),
    ]);
    const title = event.title;
    await event.deleteOne();

    await logActivity({
      actor: req.user,
      action: "event.deleted",
      summary: `Deleted event "${title}" (${mediaResult.deletedCount} media, ${regResult.deletedCount} registrations)`,
      targetType: "event",
      targetId: eventId,
      targetLabel: title,
    });

    return res.json({
      success: true,
      deleted: {
        media: mediaResult.deletedCount,
        registrations: regResult.deletedCount,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Opens or closes the check-in window for one event. Kept separate from
 * updateEvent because it is a door, not a field edit: opening it is refused
 * outright when nobody has registered yet, since there would be nobody to
 * check in.
 */
export const setCheckInOpen = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { checkInOpen } = req.body || {};
    if (typeof checkInOpen !== "boolean") {
      return res.status(400).json(formatError("VALIDATION_ERROR", "checkInOpen must be true or false"));
    }

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));

    if (checkInOpen) {
      const registrationCount = await EventRegistration.countDocuments({ eventId });
      if (registrationCount === 0) {
        return res.status(400).json(
          formatError("NO_REGISTRATIONS", "This event has no registrations yet, so check-in cannot be opened.")
        );
      }
    }

    event.checkInOpen = checkInOpen;
    await event.save();

    await logActivity({
      actor: req.user,
      action: checkInOpen ? "event.checkin_opened" : "event.checkin_closed",
      summary: `${checkInOpen ? "Opened" : "Closed"} check-in for "${event.title}"`,
      targetType: "event",
      targetId: event._id,
      targetLabel: event.title,
    });

    return res.json({ checkInOpen: event.checkInOpen });
  } catch (err) {
    return next(err);
  }
};

/**
 * Every registrant for one event, with who they are, the serial/QR code that
 * proves their registration, and whether (and when, and by whom) they were
 * actually checked in at the door. This is the detail an admin needs behind
 * the summary counts shown on the events list.
 */
export const listEventRegistrations = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId)
      .select("title startDateTime endDateTime status isPremium currency plans")
      .lean();
    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));

    const registrations = await EventRegistration.find({ eventId })
      .populate("userId", "fullName email phone institution educationLevel avatarUrl")
      .populate("checkedInBy", "fullName role")
      .populate("paymentConfirmedBy", "fullName role")
      .sort({ registeredAt: -1 })
      .lean();

    const rows = registrations.map((r) => ({
      id: r._id,
      user: r.userId
        ? {
            id: r.userId._id,
            fullName: r.userId.fullName,
            email: r.userId.email,
            phone: r.userId.phone || "",
            institution: r.userId.institution || "",
            educationLevel: r.userId.educationLevel || "",
            avatarUrl: r.userId.avatarUrl || "",
          }
        : null,
      registrationCode: r.registrationCode,
      registeredAt: r.registeredAt,
      attended: r.attended,
      checkedInAt: r.checkedInAt || null,
      checkedInBy: r.checkedInBy ? { fullName: r.checkedInBy.fullName, role: r.checkedInBy.role } : null,
      planId: r.planId || null,
      planName: r.planName || "",
      amountDue: r.amountDue ?? null,
      currency: r.currency || "",
      paymentStatus: r.paymentStatus,
      paymentMethod: r.paymentMethod || "",
      paymentReference: r.paymentReference || "",
      paymentConfirmedAt: r.paymentConfirmedAt || null,
      paymentConfirmedBy: r.paymentConfirmedBy ? { fullName: r.paymentConfirmedBy.fullName, role: r.paymentConfirmedBy.role } : null,
    }));

    const attended = rows.filter((r) => r.attended).length;
    const paid = rows.filter((r) => r.paymentStatus === "paid").length;
    const pendingPayment = rows.filter((r) => r.paymentStatus === "pending").length;
    const revenue = rows.filter((r) => r.paymentStatus === "paid").reduce((sum, r) => sum + (r.amountDue || 0), 0);

    return res.json({
      event: {
        id: event._id,
        title: event.title,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        status: event.status,
        isPremium: event.isPremium,
        currency: event.currency,
        plans: event.plans || [],
      },
      counts: { total: rows.length, attended, notAttended: rows.length - attended, paid, pendingPayment, revenue },
      registrations: rows,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Manually confirms (or reverses) payment for one premium-event registration.
 * This is the whole "payment gateway" for now - an admin reviews proof of
 * payment collected outside the app and flips this switch. A future gateway
 * integration would set paymentStatus/paymentMethod automatically instead,
 * without needing any schema change here.
 */
export const setRegistrationPayment = async (req, res, next) => {
  try {
    const { eventId, registrationId } = req.params;
    const { paymentStatus, paymentReference } = req.body || {};
    if (!["pending", "paid", "refunded"].includes(paymentStatus)) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "paymentStatus must be pending, paid, or refunded"));
    }

    const registration = await EventRegistration.findOne({ _id: registrationId, eventId });
    if (!registration) return res.status(404).json(formatError("NOT_FOUND", "Registration not found"));

    registration.paymentStatus = paymentStatus;
    if (paymentReference !== undefined) registration.paymentReference = paymentReference;
    if (paymentStatus === "paid") {
      registration.paymentConfirmedAt = new Date();
      registration.paymentConfirmedBy = req.user.userId;
    } else {
      registration.paymentConfirmedAt = undefined;
      registration.paymentConfirmedBy = undefined;
    }
    await registration.save();

    const event = await Event.findById(eventId).select("title").lean();
    await logActivity({
      actor: req.user,
      action: `registration.payment_${paymentStatus}`,
      summary: `Marked payment ${paymentStatus} on "${event?.title || "an event"}"`,
      targetType: "registration",
      targetId: registration._id,
      targetLabel: event?.title || "",
    });

    return res.json({ registration });
  } catch (err) {
    return next(err);
  }
};

/** Photographer accounts an admin can pick from when assigning. */
export const listPhotographers = async (req, res, next) => {
  try {
    const users = await User.find({ role: "photographer" })
      .select("fullName email avatarUrl")
      .sort({ fullName: 1 })
      .lean();
    return res.json({
      photographers: users.map((u) => ({
        id: u._id,
        fullName: u.fullName,
        email: u.email,
        avatarUrl: u.avatarUrl || "",
      })),
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  createEvent,
  updateEvent,
  listAllEvents,
  setEventPhotographers,
  setCheckInOpen,
  deleteEvent,
  listPhotographers,
  listEventRegistrations,
  setRegistrationPayment,
};
