import test from "node:test";
import assert from "node:assert/strict";

import {
  paymentDecisionParamsSchema,
  paymentDecisionBodySchema,
} from "../src/modules/admin/admin.payment.validation.js";

const paymentId = "123e4567-e89b-12d3-a456-426614174000";

test("accepts and normalizes an uppercase verification decision", () => {
  const result = paymentDecisionBodySchema.parse({
    decision: "VERIFIED",
  });

  assert.equal(result.decision, "VERIFIED");
});

test("accepts and normalizes a lowercase verification decision", () => {
  const result = paymentDecisionBodySchema.parse({
    decision: " verified ",
  });

  assert.equal(result.decision, "VERIFIED");
});

test("accepts a rejection with a reason", () => {
  const result = paymentDecisionBodySchema.parse({
    decision: "rejected",
    rejectionreason: "  Transfer could not be reconciled.  ",
  });

  assert.equal(result.decision, "REJECTED");
  assert.equal(
    result.rejectionreason,
    "Transfer could not be reconciled.",
  );
});

test("rejects a rejection without a reason", () => {
  assert.throws(() =>
    paymentDecisionBodySchema.parse({
      decision: "REJECTED",
    }),
  );
});

test("rejects an unknown decision", () => {
  assert.throws(() =>
    paymentDecisionBodySchema.parse({
      decision: "APPROVED",
    }),
  );
});

test("accepts a lowercase payment path parameter", () => {
  const result = paymentDecisionParamsSchema.parse({
    paymentid: paymentId,
  });

  assert.equal(result.paymentId, paymentId);
});

test("accepts a camelCase payment path parameter", () => {
  const result = paymentDecisionParamsSchema.parse({
    paymentId,
  });

  assert.equal(result.paymentId, paymentId);
});

test("rejects an invalid payment id", () => {
  assert.throws(() =>
    paymentDecisionParamsSchema.parse({
      paymentid: "not-a-uuid",
    }),
  );
});