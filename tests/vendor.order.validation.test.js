import test from "node:test";
import assert from "node:assert/strict";

import {
  vendorOrderListSchema,
  vendorOrderGroupIdSchema,
  updateVendorOrderStatusSchema,
} from "../src/modules/vendors/vendor.order.validation.js";

test("applies default vendor order list pagination", () => {
  const result = vendorOrderListSchema.parse({});

  assert.deepEqual(result, {
    status: undefined,
    page: 1,
    pageSize: 20,
  });
});

test("normalizes vendor order filters", () => {
  const result = vendorOrderListSchema.parse({
    status: "NEW",
    page: "2",
    pagesize: "5",
  });

  assert.deepEqual(result, {
    status: "NEW",
    page: 2,
    pageSize: 5,
  });
});

test("accepts a fulfilment status update", () => {
  const result = updateVendorOrderStatusSchema.parse({
    status: "READY",
    vendornotes: "Order packed and ready for pickup.",
  });

  assert.equal(result.status, "ready");
  assert.equal(
    result.vendornotes,
    "Order packed and ready for pickup.",
  );
});

test("rejects moving back to pending payment", () => {
  assert.throws(() =>
    updateVendorOrderStatusSchema.parse({
      status: "PENDING_PAYMENT",
    }),
  );
});

test("rejects an invalid vendor order group id", () => {
  assert.throws(() =>
    vendorOrderGroupIdSchema.parse({
      groupid: "group-1",
    }),
  );
});