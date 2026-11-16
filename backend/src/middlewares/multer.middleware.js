import multer, { diskStorage } from "multer";
import { FILE_UPLOADS_DIR } from "../constants.js";
import path from "path";
import { v4 as uuid } from "uuid";
import ApiError from "../utils/ApiError.js";

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE_BYTES || 100 * 1024 * 1024);
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg",
  "application/zip", "application/x-zip-compressed"
]);

const storage = diskStorage({
  destination: (_req, _file, cb) => cb(null, FILE_UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${uuid()}${path.extname(file.originalname).toLowerCase()}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 10 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(new ApiError(415, "This file type is not supported"));
    cb(null, true);
  },
});
