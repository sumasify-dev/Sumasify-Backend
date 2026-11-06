import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createPaymentController,
} from "../src/modules/payments/payment.controller.js";

const validRequest = {
  params: {
    orderid: "550e8400-e29b-41d4-a716-446655440000",
  },
  body: {
    bankreference: "TRF-123456789",
  },
  headers: {
    "idempotency-key": "payment-key-123",
  },
  user: {
    id: "buyer-123",
  },
};

const paymentResponse = {
  data: {
    payment: {
      id: "payment-123",
      status: "SUBMITTED",
      amount: "43000.00",
      bankreference: "TRF-123456789",
      submittedat: new Date("2026-09-15T10:00:00.000Z"),
    },
    order: {
      id: validRequest.params.orderid,
      ordernumber: "SUM-20260915-0001",
      status: "PAYMENT_REVIEW",
      paymentstatus: "SUBMITTED",
    },
  },
};

function createResponse() {
  return {
    status: mock.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: mock.fn(function (data) {
      this.body = data;
      return this;
    }),
  };
}

function createNext() {
  return mock.fn();
}

function createTestController(implementation = async () => paymentResponse) {
  const submitBankTransfer = mock.fn(implementation);

  const controller = createPaymentController({
    submitBankTransfer,
  });

  return {
    controller,
    submitBankTransfer,
  };
}

// 1. Successful payment submission.
test("should submit a bank transfer and return 200", async () => {
  const { controller } = createTestController();

  const req = structuredClone(validRequest);
  const res = createResponse();
  const next = createNext();

  await controller.submitBankTransferPayment(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, paymentResponse);
  assert.equal(next.mock.callCount(), 0);
});

// 2. Passes the correct data to the payment service.
test("should pass validated request data to the payment service", async () => {
  const { controller, submitBankTransfer } = createTestController();

  const req = structuredClone(validRequest);
  const res = createResponse();
  const next = createNext();

  await controller.submitBankTransferPayment(req, res, next);

  assert.deepEqual(submitBankTransfer.mock.calls[0].arguments[0], {
    orderId: validRequest.params.orderid,
    buyerId: validRequest.user.id,
    bankReference: validRequest.body.bankreference,
    idempotencyKey: validRequest.headers["idempotency-key"],
  });
});

// 3. Invalid order ID.
test("should pass a validation error for an invalid order ID", async () => {
  const { controller, submitBankTransfer } = createTestController();

  const req = structuredClone(validRequest);
  req.params.orderid = "invalid-id";

  const res = createResponse();
  const next = createNext();

  await controller.submitBankTransferPayment(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(submitBankTransfer.mock.callCount(), 0);
});

// 4. Missing bank reference.
test("should pass a validation error when bank reference is missing", async () => {
  const { controller, submitBankTransfer } = createTestController();

  const req = structuredClone(validRequest);
  delete req.body.bankreference;

  const res = createResponse();
  const next = createNext();

  await controller.submitBankTransferPayment(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(submitBankTransfer.mock.callCount(), 0);
});

// 5. Missing idempotency key.
test("should pass a validation error when idempotency key is missing", async () => {
  const { controller, submitBankTransfer } = createTestController();

  const req = structuredClone(validRequest);
  delete req.headers["idempotency-key"];

  const res = createResponse();
  const next = createNext();

  await controller.submitBankTransferPayment(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(submitBankTransfer.mock.callCount(), 0);
});

// 6. Payment service error.
test("should pass payment service errors to error-handling middleware", async () => {
  const serviceError = new Error("Payment submission failed");

  const { controller } = createTestController(async () => {
    throw serviceError;
  });

  const req = structuredClone(validRequest);
  const res = createResponse();
  const next = createNext();

  await controller.submitBankTransferPayment(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(next.mock.calls[0].arguments[0], serviceError);
});