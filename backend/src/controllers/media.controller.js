import Event, { canManageEventMedia } from "../models/Event.js";
import Media from "../models/Media.js";
import { isStorageReady, removeMedia, storeMedia } from "../config/storage.js";

const formatError = (code, message) => ({ error: { code, message } });

// Only reachable when MEDIA_STORAGE=cloudinary without credentials. The default
// local driver is always ready, so a fresh clone can upload immediately.
const storageUnconfigured = (res) =>
  res
    .status(503)
    .json(
      formatError(
        "MEDIA_STORAGE_UNCONFIGURED",
        "Media storage is set to cloudinary but has no credentials. Add them to backend/.env, or set MEDIA_STORAGE=local to store uploads on disk."
      )
    );

// Admins cover every event; a photographer only the ones they are assigned to.
const notAssigned = (res) =>
  res
    .status(403)
    .json(
      formatError(
        "NOT_ASSIGNED",
        "You are not assigned to this event. Ask an admin to add you to it."
      )
    );

const toMediaDTO = (doc) => ({
  id: doc._id,
  eventId: doc.eventId,
  url: doc.url,
  thumbnailUrl: doc.thumbnailUrl,
  type: doc.type,
  caption: doc.caption,
  uploadedBy: doc.uploadedBy,
  createdAt: doc.createdAt,
});

export const uploadMedia = async (req, res, next) => {
  try {
    if (!isStorageReady) return storageUnconfigured(res);

    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json(formatError("NOT_FOUND", "Event not found"));
    }
    if (!canManageEventMedia(event, req.user)) return notAssigned(res);
    if (!req.file) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "file is required"));
    }

    const stored = await storeMedia(req.file.buffer, {
      eventId,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
    });

    const media = await Media.create({
      eventId,
      uploadedBy: req.user.userId,
      type: stored.type,
      url: stored.url,
      thumbnailUrl: stored.thumbnailUrl,
      publicId: stored.publicId,
      caption: req.body?.caption || "",
      width: stored.width,
      height: stored.height,
    });

    return res.status(201).json(toMediaDTO(media));
  } catch (err) {
    return next(err);
  }
};

export const listMediaForManagement = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));
    if (!canManageEventMedia(event, req.user)) return notAssigned(res);

    const media = await Media.find({ eventId }).sort({ createdAt: -1 }).lean();
    return res.json({ media: media.map(toMediaDTO) });
  } catch (err) {
    return next(err);
  }
};

export const deleteMedia = async (req, res, next) => {
  try {
    if (!isStorageReady) return storageUnconfigured(res);

    const { eventId, mediaId } = req.params;
    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json(formatError("NOT_FOUND", "Event not found"));
    if (!canManageEventMedia(event, req.user)) return notAssigned(res);

    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json(formatError("NOT_FOUND", "Media not found"));
    }

    const isOwner = media.uploadedBy.toString() === req.user.userId;
    if (req.user.role !== "admin" && !isOwner) {
      return res.status(403).json(formatError("FORBIDDEN", "You can only delete your own uploads"));
    }

    await removeMedia(media.publicId, media.type);
    await media.deleteOne();
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

export default {
  uploadMedia,
  listMediaForManagement,
  deleteMedia,
};
