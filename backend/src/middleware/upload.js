import multer from "multer";

const formatError = (code, message) => ({ error: { code, message } });

const maxFileSizeBytes = (Number(process.env.MEDIA_MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  const isAllowed = file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
  if (!isAllowed) {
    const err = new Error("Only image or video files are allowed");
    err.status = 400;
    err.code = "VALIDATION_ERROR";
    return cb(err);
  }
  return cb(null, true);
};

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSizeBytes },
  fileFilter,
});

export const handleUploadErrors = (err, req, res, next) => {
  if (err && err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json(formatError("VALIDATION_ERROR", "File exceeds the maximum allowed size"));
    }
    return res.status(400).json(formatError("VALIDATION_ERROR", err.message));
  }
  return next(err);
};

export default upload;
