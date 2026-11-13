import test, { mock } from "node:test";
import assert from "node:assert/strict";

import { createVendorApplicationController } from "../src/modules/vendors/vendor.application.controller.js";

const submitResponse = {
  data: {
    id: "application-1",
    status: "pending",
  },
};

const getResponse = {
  data: {
    id: "application-1",
    status: "pending",
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
  const submitApplication = mock.fn(
    overrides.submitApplication ?? (async () => submitResponse),
  );
  const getMyApplication = mock.fn(
    overrides.getMyApplication ?? (async () => getResponse),
  );

  return {
    controller: createVendorApplicationController({
      submitApplication,
      getMyApplication,
    }),
    submitApplication,
    getMyApplication,
  };
}

const validRequest = {
  user: { id: "buyer-1" },
  body: {
    businessname: "Kemi's Store",
    contactphone: "08012345678",
    description: "Fashion and accessories store",
    categorynotes: "Fashion",
  },
};

test("submits an application and returns 201", async () => {
  const { controller, submitApplication } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.submit(structuredClone(validRequest), res, next);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, submitResponse);
  assert.equal(next.mock.callCount(), 0);
  assert.deepEqual(
    submitApplication.mock.calls[0].arguments[0],
    {
      userId: "buyer-1",
      data: validRequest.body,
    },
  );
});

test("returns the buyer's latest application with 200", async () => {
  const { controller, getMyApplication } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.getMine({ user: { id: "buyer-1" } }, res, next);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, getResponse);
  assert.deepEqual(
    getMyApplication.mock.calls[0].arguments[0],
    { userId: "buyer-1" },
  );
});

test("forwards validation errors without calling the service", async () => {
  const { controller, submitApplication } = createController();
  const req = structuredClone(validRequest);
  delete req.body.businessname;

  const res = createResponse();
  const next = mock.fn();

  await controller.submit(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(submitApplication.mock.callCount(), 0);
});

test("forwards service errors to the error handler", async () => {
  const serviceError = new Error("application failed");
  const { controller } = createController({
    submitApplication: async () => {
      throw serviceError;
    },
  });

  const res = createResponse();
  const next = mock.fn();

  await controller.submit(
    structuredClone(validRequest),
    res,
    next,
  );

  assert.equal(next.mock.calls[0].arguments[0], serviceError);
});