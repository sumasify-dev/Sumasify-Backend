import test from "node:test";
import assert from "node:assert/strict";

import {
  orderListQuerySchema,
  orderIdSchema,
} from "../src/modules/orders/order.validation.js";

test("accepts valid buyer order pagination parameters", () => {
  const result = orderListQuerySchema.parse({
    page: "1",
    pagesize: "20",
  });

  assert.equal(result.page, 1);
  assert.equal(result.pagesize, 20);
});

test("applies default pagination values when none are provided", () => {
  const result = orderListQuerySchema.parse({});

  assert.equal(result.page, 1);
  assert.equal(result.pagesize, 20);
});

test("accepts valid order status", () => {
  const result = orderListQuerySchema.parse({
    status: "paid",
  });

  assert.equal(result.status, "paid");
});

test("rejects invalid order status", () => {
  assert.throws(() => {
    orderListQuerySchema.parse({
      status: "processing",
    });
  });
});

test("rejects page numbers below 1", () => {
  assert.throws(() => {
    orderListQuerySchema.parse({
      page: "0",
    });
  });
});

test("rejects page sizes above 50", () => {
  assert.throws(() => {
    orderListQuerySchema.parse({
      pagesize: "51",
    });
  });
});

test("accepts a valid order UUID", () => {
  const result = orderIdSchema.parse({
    orderid: "123e4567-e89b-12d3-a456-426614174000",
  });

  assert.equal(
    result.orderid,
    "123e4567-e89b-12d3-a456-426614174000"
  );
});

test("rejects an invalid order UUID", () => {
  assert.throws(() => {
    orderIdSchema.parse({
      orderid: "invalid-order-id",
    });
  });
});