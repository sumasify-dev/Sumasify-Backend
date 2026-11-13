import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_IMAGE_BYTES,
  detectImageType,
  validateImageFile,
} from "../src/modules/uploads/image.validation.js";

function pngBuffer(size = 16) {
  const buffer = Buffer.alloc(size);
  Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]).copy(buffer);
  return buffer;
}

function jpegBuffer(size = 16) {
  const buffer = Buffer.alloc(size);
  Buffer.from([0xff, 0xd8, 0xff]).copy(buffer);
  return buffer;
}

function webpBuffer(size = 16) {
  const buffer = Buffer.alloc(size);
  buffer.write("RIFF", 0, "ascii");
  buffer.write("WEBP", 8, "ascii");
  return buffer;
}

test("detects supported image formats from magic bytes", () => {
  assert.equal(detectImageType(pngBuffer()), "image/png");
  assert.equal(detectImageType(jpegBuffer()), "image/jpeg");
  assert.equal(detectImageType(webpBuffer()), "image/webp");
});

test("rejects a buffer that is not an image", () => {
  assert.equal(detectImageType(Buffer.from("not an image")), null);
});

test("accepts a valid PNG upload", () => {
  const buffer = pngBuffer();

  const result = validateImageFile({
    buffer,
    size: buffer.length,
    mimetype: "image/png",
  });

  assert.equal(result.contentType, "image/png");
  assert.equal(result.size, buffer.length);
});

test("rejects an unsupported mime type", () => {
  assert.throws(
    () =>
      validateImageFile({
        buffer: pngBuffer(),
        size: 16,
        mimetype: "image/gif",
      }),
    (error) => error.code === "INVALID_IMAGE_TYPE",
  );
});

test("rejects a declared mime type that does not match the bytes", () => {
  assert.throws(
    () =>
      validateImageFile({
        buffer: pngBuffer(),
        size: 16,
        mimetype: "image/jpeg",
      }),
    (error) => error.code === "INVALID_IMAGE_TYPE",
  );
});

test("rejects an oversized image", () => {
  assert.throws(
    () =>
      validateImageFile({
        buffer: pngBuffer(),
        size: MAX_IMAGE_BYTES + 1,
        mimetype: "image/png",
      }),
    (error) => error.code === "IMAGE_TOO_LARGE",
  );
});

test("requires a file", () => {
  assert.throws(
    () => validateImageFile(undefined),
    (error) => error.code === "IMAGE_REQUIRED",
  );
});