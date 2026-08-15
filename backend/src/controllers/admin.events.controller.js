import Event from "../models/Event.js";

const formatError = (code, message) => ({ error: { code, message } });

const validateEventPayload = (body, isUpdate = false) => {
  const allowed = [
    "title",
    "description",
    "location",
    "startDateTime",
    "endDateTime",
    "visibility",
    "published",
  ];
  const payload = {};
  allowed.forEach((key) => {
    if (body[key] !== undefined) payload[key] = body[key];
  });
  if (!isUpdate) {
    if (!payload.title) return { error: formatError("VALIDATION_ERROR", "title is required") };
    if (!payload.startDateTime) return { error: formatError("VALIDATION_ERROR", "startDateTime is required") };
    if (!payload.endDateTime) return { error: formatError("VALIDATION_ERROR", "endDateTime is required") };
  }
  if (!payload.visibility) payload.visibility = "public";
  if (payload.published === undefined) payload.published = true;
  return { payload };
};

export const createEvent = async (req, res, next) => {
  try {
    const { payload, error } = validateEventPayload(req.body);
    if (error) return res.status(400).json(error);
    const event = await Event.create({ ...payload, createdBy: req.user.userId });
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
    const event = await Event.findByIdAndUpdate(eventId, payload, { new: true });
    if (!event) {
      return res.status(404).json(formatError("NOT_FOUND", "Event not found"));
    }
    return res.json(event);
  } catch (err) {
    return next(err);
  }
};

export default {
  createEvent,
  updateEvent,
};
