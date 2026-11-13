import test, { mock } from "node:test";
import assert from "node:assert/strict";

import { createCheckoutController } from "../src/modules/checkout/checkout.controller.js";

const addressId = "123e4567-e89b-12d3-a456-426614174000";
const vendorId = "223e4567-e89b-12d3-a456-426614174000";

const previewResponse = {
  data: {
    currency: "NGN",
    subtotalamount: "40000.00",
    deliveryamount: "2000.00",
    totalamount: "42000.00",
    vendorgroups: [],
    warnings: [],
  },
};

const createResponse = {
  data: {
    order: {
      id: "order-1",
      ordernumber: "SUM-20261113-0001",
    },
    payment: {
      id: "payment-1",
    },
    paymentinstructions: {
      reference: "SUM-20261113-0001",
    },
  },
};

function createHttpResponse() {
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
  const previewCheckout = mock.fn(
    overrides.previewCheckout ?? (async () => previewResponse),
  );
  const createCheckoutOrder = mock.fn(
    overrides.createCheckoutOrder ?? (async () => createResponse),
  );

  return {
    controller: createCheckoutController({
      previewCheckout,
      createCheckoutOrder,
    }),
    previewCheckout,
    createCheckoutOrder,
  };
}

const validPreviewRequest = {
  user: { id: "buyer-1" },
  body: {
    addressid: addressId,
    deliverypreferences: {
      [vendorId]: { method: "DELIVERY" },
    },
  },
};

const validCreateRequest = {
  user: { id: "buyer-1" },
  body: {
    addressid: addressId,
    deliverypreferences: {
      [vendorId]: { method: "DELIVERY" },
    },
    paymentmethod: "BANK_TRANSFER",
  },
  headers: {
    "idempotency-key": "checkout-key-1",
  },
};

test("preview returns 200 and the service result", async () => {
  const { controller, previewCheckout } = createController();
  const res = createHttpResponse();
  const next = mock.fn();

  await controller.preview(
    structuredClone(validPreviewRequest),
    res,
    next,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, previewResponse);
  assert.equal(next.mock.callCount(), 0);
  assert.deepEqual(
    previewCheckout.mock.calls[0].arguments[0],
    {
      buyerId: "buyer-1",
      addressid: addressId,
      deliverypreferences: validPreviewRequest.body.deliverypreferences,
    },
  );
});

test("create returns 201 and passes the idempotency key to the service", async () => {
  const { controller, createCheckoutOrder } = createController();
  const res = createHttpResponse();
  const next = mock.fn();

  await controller.create(
    structuredClone(validCreateRequest),
    res,
    next,
  );

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, createResponse);
  assert.equal(next.mock.callCount(), 0);
  assert.deepEqual(
    createCheckoutOrder.mock.calls[0].arguments[0],
    {
      buyerId: "buyer-1",
      addressid: addressId,
      deliverypreferences: validCreateRequest.body.deliverypreferences,
      paymentmethod: "BANK_TRANSFER",
      idempotencykey: "checkout-key-1",
    },
  );
});

test("create requires an idempotency key", async () => {
  const { controller, createCheckoutOrder } = createController();
  const req = structuredClone(validCreateRequest);
  delete req.headers["idempotency-key"];

  const res = createHttpResponse();
  const next = mock.fn();

  await controller.create(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(createCheckoutOrder.mock.callCount(), 0);
});

test("create rejects unsupported payment methods before calling the service", async () => {
  const { controller, createCheckoutOrder } = createController();
  const req = structuredClone(validCreateRequest);
  req.body.paymentmethod = "CARD";

  const res = createHttpResponse();
  const next = mock.fn();

  await controller.create(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(createCheckoutOrder.mock.callCount(), 0);
});

test("preview forwards validation errors", async () => {
  const { controller, previewCheckout } = createController();
  const req = structuredClone(validPreviewRequest);
  req.body.addressid = "not-a-uuid";

  const res = createHttpResponse();
  const next = mock.fn();

  await controller.preview(req, res, next);

  assert.equal(next.mock.callCount(), 1);
  assert.equal(previewCheckout.mock.callCount(), 0);
});

test("service errors are forwarded to the error handler", async () => {
  const serviceError = new Error("checkout failed");
  const { controller } = createController({
    previewCheckout: async () => {
      throw serviceError;
    },
  });

  const res = createHttpResponse();
  const next = mock.fn();

  await controller.preview(
    structuredClone(validPreviewRequest),
    res,
    next,
  );

  assert.equal(next.mock.callCount(), 1);
  assert.equal(next.mock.calls[0].arguments[0], serviceError);
});