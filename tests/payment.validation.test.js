import test from "node:test";
import assert from "node:assert/strict";

import {
  paymentSubmissionParamsSchema,
  paymentSubmissionBodySchema,
  paymentSubmissionHeadersSchema,
} from "../src/modules/payments/payment.validation.js";

// --------------------------------------
// ORDER ID VALIDATION
// --------------------------------------

test("accepts a valid order UUID", () => {
  const result = paymentSubmissionParamsSchema.safeParse({
    orderid: "550e8400-e29b-41d4-a716-446655440000",
  });

  assert.equal(result.success, true);
});

test("rejects an invalid order UUID", () => {
  const result = paymentSubmissionParamsSchema.safeParse({
    orderid: "invalid-order-id",
  });

  assert.equal(result.success, false);
});

// --------------------------------------
// BANK REFERENCE VALIDATION
// --------------------------------------

test("accepts a valid bank reference", () => {
  const result = paymentSubmissionBodySchema.safeParse({
    bankreference: "TRF-123456789",
  });

  assert.equal(result.success, true);
});

test("rejects a missing bank reference", () => {
  const result = paymentSubmissionBodySchema.safeParse({});

  assert.equal(result.success, false);
});

test("rejects an empty bank reference", () => {
  const result = paymentSubmissionBodySchema.safeParse({
    bankreference: "",
  });

  assert.equal(result.success, false);
});

test("rejects a bank reference exceeding 100 characters", () => {
  const result = paymentSubmissionBodySchema.safeParse({
    bankreference: "A".repeat(101),
  });

  assert.equal(result.success, false);
});

test("trims whitespace around a bank reference", () => {
  const result = paymentSubmissionBodySchema.safeParse({
    bankreference: "  TRF-123456789  ",
  });

  assert.equal(result.success, true);
  assert.equal(result.data.bankreference, "TRF-123456789");
});

// --------------------------------------
// IDEMPOTENCY KEY VALIDATION
// --------------------------------------

test("accepts a valid idempotency key", () => {
  const result = paymentSubmissionHeadersSchema.safeParse({
    "idempotency-key": "payment-key-123",
  });

  assert.equal(result.success, true);
});

test("rejects a missing idempotency key", () => {
  const result = paymentSubmissionHeadersSchema.safeParse({});

  assert.equal(result.success, false);
});

test("rejects an empty idempotency key", () => {
  const result = paymentSubmissionHeadersSchema.safeParse({
    "idempotency-key": "",
  });

  assert.equal(result.success, false);
});

test("rejects an idempotency key exceeding 255 characters", () => {
  const result = paymentSubmissionHeadersSchema.safeParse({
    "idempotency-key": "A".repeat(256),
  });

  assert.equal(result.success, false);
});

test("trims whitespace around an idempotency key", () => {
  const result = paymentSubmissionHeadersSchema.safeParse({
    "idempotency-key": "  payment-key-123  ",
  });

  assert.equal(result.success, true);
  assert.equal(result.data["idempotency-key"], "payment-key-123");
});