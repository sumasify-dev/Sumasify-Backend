import test, { mock } from "node:test";
import assert from "node:assert/strict";

import { createVendorProfileController } from "../src/modules/vendors/vendor.profile.controller.js";

const profileResponse = {
  data: {
    id: "vendor-1",
    businessname: "Kemi's Store",
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
  const getProfile = mock.fn(
    overrides.getProfile ?? (async () => profileResponse),
  );
  const updateProfile = mock.fn(
    overrides.updateProfile ?? (async () => profileResponse),
  );

  return {
    controller: createVendorProfileController({
      getProfile,
      updateProfile,
    }),
    getProfile,
    updateProfile,
  };
}

test("returns the vendor profile with 200", async () => {
  const { controller, getProfile } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.get({ user: { id: "user-1" } }, res, next);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, profileResponse);
  assert.deepEqual(
    getProfile.mock.calls[0].arguments[0],
    { userId: "user-1" },
  );
});

test("updates the vendor profile with 200", async () => {
  const { controller, updateProfile } = createController();
  const req = {
    user: { id: "user-1" },
    body: {
      businessname: "Kemi's Fashion",
      contactphone: "08012345678",
    },
  };

  const res = createResponse();
  const next = mock.fn();

  await controller.update(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    updateProfile.mock.calls[0].arguments[0],
    {
      userId: "user-1",
      data: req.body,
    },
  );
});

test("rejects an empty profile update", async () => {
  const { controller, updateProfile } = createController();

  const res = createResponse();
  const next = mock.fn();

  await controller.update(
    { user: { id: "user-1" }, body: {} },
    res,
    next,
  );

  assert.equal(next.mock.callCount(), 1);
  assert.equal(updateProfile.mock.callCount(), 0);
});

test("forwards service errors to the error handler", async () => {
  const serviceError = new Error("profile failed");
  const { controller } = createController({
    getProfile: async () => {
      throw serviceError;
    },
  });

  const res = createResponse();
  const next = mock.fn();

  await controller.get({ user: { id: "user-1" } }, res, next);

  assert.equal(next.mock.calls[0].arguments[0], serviceError);
});