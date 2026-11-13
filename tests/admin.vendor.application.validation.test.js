import test from "node:test";
import assert from "node:assert/strict";

import {
  adminVendorApplicationListSchema,
  vendorApplicationIdSchema,
  vendorApplicationDecisionSchema,
} from "../src/modules/admin/admin.vendor.application.validation.js";

test("applies default list pagination", () => {
  const result = adminVendorApplicationListSchema.parse({});

  assert.equal(result.page, 1);
  assert.equal(result.pageSize, 20);
  assert.equal(result.status, undefined);
});

test("accepts pagesize and normalizes status to the database value", () => {
  const result = adminVendorApplicationListSchema.parse({
    page: "2",
    pagesize: "10",
    status: "Pending",
  });

  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 10);
  assert.equal(result.status, "PENDING");
});

test("rejects an unknown application status", () => {
  assert.throws(() =>
    adminVendorApplicationListSchema.parse({
      status: "processing",
    }),
  );
});

test("caps list page size at 50", () => {
  assert.throws(() =>
    adminVendorApplicationListSchema.parse({
      pagesize: "51",
    }),
  );
});

test("accepts and normalizes an approval decision", () => {
  const result = vendorApplicationDecisionSchema.parse({
    decision: " Approved ",
  });

  assert.equal(result.decision, "approved");
});

test("accepts a rejection with a reason", () => {
  const result = vendorApplicationDecisionSchema.parse({
    decision: "REJECTED",
    rejectionreason: "Insufficient business information.",
  });

  assert.equal(result.decision, "rejected");
});

test("requires a reason when rejecting", () => {
  assert.throws(() =>
    vendorApplicationDecisionSchema.parse({
      decision: "rejected",
    }),
  );
});

test("rejects an invalid application id", () => {
  assert.throws(() =>
    vendorApplicationIdSchema.parse({
      id: "not-a-uuid",
    }),
  );
});