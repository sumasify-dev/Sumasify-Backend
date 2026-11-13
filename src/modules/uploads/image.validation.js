import { AppError } from "../../middleware/utils/AppError.js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function hasJpegMagic(buffer) {
  return (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  );
}

function hasPngMagic(buffer) {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function hasWebpMagic(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  );
}

export function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    return null;
  }

  if (hasJpegMagic(buffer)) return "image/jpeg";
  if (hasPngMagic(buffer)) return "image/png";
  if (hasWebpMagic(buffer)) return "image/webp";

  return null;
}

export function validateImageFile(file) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new AppError(
      "An image file is required",
      400,
      "IMAGE_REQUIRED",
    );
  }

  if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError(
      "Image cannot exceed 5 MB",
      400,
      "IMAGE_TOO_LARGE",
    );
  }

  if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
    throw new AppError(
      "Only JPEG, PNG and WebP images are supported",
      400,
      "INVALID_IMAGE_TYPE",
    );
  }

  const detectedType = detectImageType(file.buffer);

  if (!detectedType || detectedType !== file.mimetype) {
    throw new AppError(
      "The uploaded file is not a valid JPEG, PNG or WebP image",
      400,
      "INVALID_IMAGE_TYPE",
    );
  }

  return {
    contentType: detectedType,
    size: file.buffer.length,
  };
}