import Event from "../models/Event.js";
import Media from "../models/Media.js";
import cloudinary, { uploadBufferToCloudinary } from "../config/cloudinary.js";

const formatError = (code, message) => ({ error: { code, message } });

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

const buildThumbnailUrl = (result) => {
  if (result.resource_type === "video") {
    return cloudinary.url(result.public_id, { resource_type: "video", format: "jpg" });
  }
  return cloudinary.url(result.public_id, {
    width: 400,
    height: 400,
    crop: "fill",
    format: result.format,
  });
};

export const uploadMedia = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json(formatError("NOT_FOUND", "Event not found"));
    }
    if (!req.file) {
      return res.status(400).json(formatError("VALIDATION_ERROR", "file is required"));
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: `event-media/${eventId}`,
      resource_type: "auto",
    });

    const media = await Media.create({
      eventId,
      uploadedBy: req.user.userId,
      type: result.resource_type === "video" ? "video" : "image",
      url: result.secure_url,
      thumbnailUrl: buildThumbnailUrl(result),
      publicId: result.public_id,
      caption: req.body?.caption || "",
      width: result.width,
      height: result.height,
    });

    return res.status(201).json(toMediaDTO(media));
  } catch (err) {
    return next(err);
  }
};

export const listMediaForManagement = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const media = await Media.find({ eventId }).sort({ createdAt: -1 }).lean();
    return res.json({ media: media.map(toMediaDTO) });
  } catch (err) {
    return next(err);
  }
};

export const deleteMedia = async (req, res, next) => {
  try {
    const { mediaId } = req.params;
    const media = await Media.findById(mediaId);
    if (!media) {
      return res.status(404).json(formatError("NOT_FOUND", "Media not found"));
    }

    const isOwner = media.uploadedBy.toString() === req.user.userId;
    if (req.user.role !== "admin" && !isOwner) {
      return res.status(403).json(formatError("FORBIDDEN", "You can only delete your own uploads"));
    }

    try {
      const result = await cloudinary.uploader.destroy(media.publicId, {
        resource_type: media.type === "video" ? "video" : "image",
      });
      if (result.result === "not found") {
        console.warn(`Cloudinary asset already missing for media ${media._id}, removing DB record anyway`);
      }
    } catch (cloudinaryErr) {
      return next(cloudinaryErr);
    }

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
