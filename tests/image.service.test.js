import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createImageUploadService,
} from "../src/modules/uploads/image.service.js";

const createdAt = new Date("2026-11-13T10:00:00.000Z");

function pngFile() {
  const buffer = Buffer.alloc(16);
  Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]).copy(buffer);

  return {
    buffer,
    size: buffer.length,
    mimetype: "image/png",
  };
}

function createdUpload(overrides = {}) {
  return {
    id: "upload-1",
    vendorId: "vendor-1",
    storageKey: "sumasify/products/denim",
    url: "https://cdn.example.com/denim.png",
    contentType: "image/png",
    width: 1200,
    height: 1200,
    bytes: 240000,
    attachedAt: null,
    createdAt,
    ...overrides,
  };
}

function createService(overrides = {}) {
  const findVendorByUserId = mock.fn(
    overrides.findVendorByUserId ??
      (async () => ({ id: "vendor-1", status: "ACTIVE" })),
  );
  const createProductImageUpload = mock.fn(
    overrides.createProductImageUpload ??
      (async () => createdUpload()),
  );
  const storage = {
    upload: mock.fn(
      overrides.storageUpload ??
        (async () => ({
          storagekey: "sumasify/products/denim",
          url: "https://cdn.example.com/denim.png",
          width: 1200,
          height: 1200,
          bytes: 240000,
        })),
    ),
  };

  return {
    service: createImageUploadService({
      findVendorByUserId,
      createProductImageUpload,
      storage,
    }),
    findVendorByUserId,
    createProductImageUpload,
    storage,
  };
}

test("uploads an image and persists its metadata", async () => {
  const { service, createProductImageUpload, storage } =
    createService();

  const result = await service.uploadProductImage({
    userId: "user-1",
    file: pngFile(),
  });

  assert.deepEqual(result, {
    data: {
      uploadid: "upload-1",
      url: "https://cdn.example.com/denim.png",
      storagekey: "sumasify/products/denim",
      contenttype: "image/png",
      width: 1200,
      height: 1200,
      bytes: 240000,
    },
  });
  assert.equal(storage.upload.mock.callCount(), 1);
  assert.deepEqual(
    createProductImageUpload.mock.calls[0].arguments[0],
    {
      vendorId: "vendor-1",
      storageKey: "sumasify/products/denim",
      url: "https://cdn.example.com/denim.png",
      contentType: "image/png",
      width: 1200,
      height: 1200,
      bytes: 240000,
    },
  );
});

test("rejects uploads from a non-approved vendor", async () => {
  const { service, storage } = createService({
    findVendorByUserId: async () => null,
  });

  await assert.rejects(
    () =>
      service.uploadProductImage({
        userId: "user-1",
        file: pngFile(),
      }),
    (error) => error.code === "VENDOR_NOT_APPROVED",
  );
  assert.equal(storage.upload.mock.callCount(), 0);
});

test("rejects uploads from an inactive vendor", async () => {
  const { service } = createService({
    findVendorByUserId: async () => ({
      id: "vendor-1",
      status: "SUSPENDED",
    }),
  });

  await assert.rejects(
    () =>
      service.uploadProductImage({
        userId: "user-1",
        file: pngFile(),
      }),
    (error) => error.code === "VENDOR_INACTIVE",
  );
});

test("rejects an invalid file before uploading", async () => {
  const { service, storage } = createService();
  const file = pngFile();
  file.mimetype = "image/jpeg";

  await assert.rejects(
    () =>
      service.uploadProductImage({
        userId: "user-1",
        file,
      }),
    (error) => error.code === "INVALID_IMAGE_TYPE",
  );
  assert.equal(storage.upload.mock.callCount(), 0);
});

test("propagates storage failures", async () => {
  const storageError = new Error("cloudinary unavailable");
  const { service, createProductImageUpload } = createService({
    storageUpload: async () => {
      throw storageError;
    },
  });

  await assert.rejects(
    () =>
      service.uploadProductImage({
        userId: "user-1",
        file: pngFile(),
      }),
    (error) => error === storageError,
  );
  assert.equal(createProductImageUpload.mock.callCount(), 0);
});