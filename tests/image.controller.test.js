import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createImageController,
} from "../src/modules/uploads/image.controller.js";

const uploadResponse = {
  data: {
    uploadid: "upload-1",
    url: "https://cdn.example.com/denim.png",
  },
};

function createResponse() {
  return {
    status: mock.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: mock.fn(function (body) {
      this.body = body;
      return this;
    }),
  };
}

function createController(overrides = {}) {
  const uploadProductImage = mock.fn(
    overrides.uploadProductImage ?? (async () => uploadResponse),
  );

  return {
    controller: createImageController({
      uploadProductImage,
    }),
    uploadProductImage,
  };
}

test("uploads an image and returns 201", async () => {
  const { controller, uploadProductImage } = createController();
  const file = { buffer: Buffer.from("png") };
  const res = createResponse();
  const next = mock.fn();

  await controller.upload(
    { user: { id: "user-1" }, file },
    res,
    next,
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, uploadResponse);
  assert.deepEqual(
    uploadProductImage.mock.calls[0].arguments[0],
    {
      userId: "user-1",
      file,
    },
  );
});

test("forwards service errors to the error handler", async () => {
  const serviceError = new Error("upload failed");
  const { controller } = createController({
    uploadProductImage: async () => {
      throw serviceError;
    },
  });

  const res = createResponse();
  const next = mock.fn();

  await controller.upload(
    { user: { id: "user-1" }, file: undefined },
    res,
    next,
  );

  assert.equal(next.mock.calls[0].arguments[0], serviceError);
});