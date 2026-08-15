import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import cloudinary, { isCloudinaryConfigured, uploadBufferToCloudinary } from "./cloudinary.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const uploadsDir = path.resolve(currentDir, "../../uploads");

// MEDIA_STORAGE picks the driver explicitly. With nothing set we use Cloudinary
// when it has credentials and fall back to local disk otherwise, so a fresh
// clone can upload media without signing up for anything.
const requested = (process.env.MEDIA_STORAGE || "").trim().toLowerCase();
export const storageDriver = requested || (isCloudinaryConfigured ? "cloudinary" : "local");

export const isStorageReady = storageDriver === "local" || isCloudinaryConfigured;

const publicBaseUrl = () =>
  (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, "");

const extensionFor = (originalName, mimetype) => {
  const fromName = path.extname(originalName || "").toLowerCase();
  if (fromName) return fromName;
  const subtype = (mimetype || "").split("/")[1];
  return subtype ? `.${subtype.replace(/[^a-z0-9]/gi, "")}` : "";
};

const typeFor = (mimetype) => ((mimetype || "").startsWith("video/") ? "video" : "image");

/**
 * publicId is stored in the database and later joined back onto uploadsDir to
 * delete the file, so resolve it and confirm it did not escape that directory.
 */
const resolveInsideUploads = (publicId) => {
  const target = path.resolve(uploadsDir, publicId);
  if (target !== uploadsDir && !target.startsWith(uploadsDir + path.sep)) {
    const err = new Error("Refusing to touch a path outside the uploads directory");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return target;
};

const localDriver = {
  store: async (buffer, { eventId, originalName, mimetype }) => {
    const dir = path.join(uploadsDir, String(eventId));
    await fs.mkdir(dir, { recursive: true });

    const filename = `${crypto.randomBytes(16).toString("hex")}${extensionFor(originalName, mimetype)}`;
    await fs.writeFile(path.join(dir, filename), buffer);

    const publicId = `${eventId}/${filename}`;
    const url = `${publicBaseUrl()}/uploads/${publicId}`;

    return {
      url,
      // No transformation service on disk, so the full file doubles as its own
      // thumbnail and the gallery constrains it with CSS.
      thumbnailUrl: url,
      publicId,
      type: typeFor(mimetype),
    };
  },

  remove: async (publicId) => {
    const target = resolveInsideUploads(publicId);
    try {
      await fs.unlink(target);
    } catch (err) {
      // Already gone is fine; the database record should still be removed.
      if (err.code !== "ENOENT") throw err;
    }
  },
};

const cloudinaryThumbnail = (result) => {
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

const cloudinaryDriver = {
  store: async (buffer, { eventId }) => {
    const result = await uploadBufferToCloudinary(buffer, {
      folder: `event-media/${eventId}`,
      resource_type: "auto",
    });

    return {
      url: result.secure_url,
      thumbnailUrl: cloudinaryThumbnail(result),
      publicId: result.public_id,
      type: result.resource_type === "video" ? "video" : "image",
      width: result.width,
      height: result.height,
    };
  },

  remove: async (publicId, type) => {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: type === "video" ? "video" : "image",
    });
    if (result.result === "not found") {
      console.warn(`Cloudinary asset already missing for ${publicId}, removing DB record anyway`);
    }
  },
};

const driver = storageDriver === "cloudinary" ? cloudinaryDriver : localDriver;

export const storeMedia = (buffer, meta) => driver.store(buffer, meta);
export const removeMedia = (publicId, type) => driver.remove(publicId, type);

export default { storeMedia, removeMedia, storageDriver, isStorageReady, uploadsDir };
