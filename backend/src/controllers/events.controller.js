import Event from "../models/Event.js";

const formatError = (code, message) => ({ error: { code, message } });

export const listPublic = async (req, res, next) => {
  try {
    // Drafts stay hidden; open and completed public events are both listed so
    // past events remain browsable.
    const events = await Event.find({
      published: true,
      visibility: "public",
      status: { $ne: "draft" },
    })
      .sort({ startDateTime: 1 })
      .lean();
    return res.json(events);
  } catch (err) {
    return next(err);
  }
};

export const getEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).lean();
    if (!event) {
      return res.status(404).json(formatError("NOT_FOUND", "Event not found"));
    }
    return res.json(event);
  } catch (err) {
    return next(err);
  }
};

export default {
  listPublic,
  getEvent,
};
