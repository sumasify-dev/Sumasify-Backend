import test, { mock } from "node:test";
import assert from "node:assert/strict";

import { createAdminPaymentController } from "../src/modules/admin/admin.payment.controller.js";

const paymentId = "123e4567-e89b-12d3-a456-426614174000";

const responseBody = {
  data: {
    payment: {
      id: paymentId,
      status: "VERIFIED",
    },
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
  const decidePayment = mock.fn(
    overrides.decidePayment ?? (async () => responseBody),
  );

  return {
    controller: createAdminPaymentController({
      decidePayment,
    }),
    decidePayment,
  };
}

const validRequest = {
  params: {
    paymentid: paymentId,
  },
  body: {
    decision: "VERIFIED",
  },
  user: {
    id: "admin-1",
  },
};

test("returns 200 and passes the verified decision to the service", async () => {
  const { controller, decidePayment } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.decide(
    structuredClone(validRequest),
    res,
    next,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, responseBody);
  assert.equal(next.mock.callCount(), 0);
  assert.deepEqual(
    decidePayment.mock.calls[0].arguments[0],
    {
      paymentId,
      adminUserId: "admin-1",
      decision: "VERIFIED",
      rejectionReason: null,
    },
  );
});

test("passes a rejection reason to the service", async () => {
  const { controller, decidePayment } = createController();
  const req = structuredClone(validRequest);
  req.body = {
    decision: "rejected",
    rejectionreason: "Transfer could not be reconciled.",
  };

  const res = createResponse();
  const next = mock.fn();

  await controller.decide(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    decidePayment.mock.calls[0].arguments[0],
    {
      paymentId,
      adminUserId: "admin-1",
      decision: "REJECTED",
      rejectionReason: "Transfer could not be reconciled.",
    },
  );
});

test("forwards validation errors without calling the service", async () => {
  const { controller, decidePayment } = createController();
  const req = structuredClone(validRequest);
  req.body.decision = "APPROVED";

  const res = createResponse();
  const next = mock.fn();

  await controller.decide(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(decidePayment.mock.callCount(), 0);
});

test("requires a reason when rejecting", async () => {
  const { controller, decidePayment } = createController();
  const req = structuredClone(validRequest);
  req.body.decision = "REJECTED";

  const res = createResponse();
  const next = mock.fn();

  await controller.decide(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(decidePayment.mock.callCount(), 0);
});

test("rejects an invalid payment id", async () => {
  const { controller, decidePayment } = createController();
  const req = structuredClone(validRequest);
  req.params.paymentid = "not-a-uuid";

  const res = createResponse();
  const next = mock.fn();

  await controller.decide(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(decidePayment.mock.callCount(), 0);
});

test("forwards service errors to the error handler", async () => {
  const serviceError = new Error("payment decision failed");
  const { controller } = createController({
    decidePayment: async () => {
      throw serviceError;
    },
  });

  const res = createResponse();
  const next = mock.fn();

  await controller.decide(
    structuredClone(validRequest),
    res,
    next,
  );

  assert.equal(next.mock.calls[0].arguments[0], serviceError);
});