import test from "node:test";
import assert from "node:assert/strict";

import {
  vendorProductListSchema,
  createVendorProductSchema,
  updateVendorProductSchema,
  updateVendorInventorySchema,
} from "../src/modules/vendors/vendor.product.validation.js";

const categoryId = "123e4567-e89b-12d3-a456-426614174000";
const uploadId = "223e4567-e89b-12d3-a456-426614174000";

const validProduct = {
  name: "Vintage Denim",
  description: "Classic denim jacket",
  priceamount: "20000.00",
  categoryid: categoryId,
  stockonhand: 10,
};

test("applies default product list pagination", () => {
  const result = vendorProductListSchema.parse({});

  assert.deepEqual(result, {
    status: undefined,
    page: 1,
    pageSize: 20,
  });
});

test("normalizes list status and pagesize", () => {
  const result = vendorProductListSchema.parse({
    status: "Active",
    page: "2",
    pagesize: "10",
  });

  assert.deepEqual(result, {
    status: "ACTIVE",
    page: 2,
    pageSize: 10,
  });
});

test("rejects an unknown product status", () => {
  assert.throws(() =>
    vendorProductListSchema.parse({
      status: "deleted",
    }),
  );
});

test("accepts a valid product with image ids", () => {
  const result = createVendorProductSchema.parse({
    ...validProduct,
    imageids: [uploadId],
  });

  assert.equal(result.priceamount, "20000.00");
  assert.deepEqual(result.imageids, [uploadId]);
});

test("rejects a zero price", () => {
  assert.throws(() =>
    createVendorProductSchema.parse({
      ...validProduct,
      priceamount: "0.00",
    }),
  );
});

test("rejects more than five image ids", () => {
  assert.throws(() =>
    createVendorProductSchema.parse({
      ...validProduct,
      imageids: Array.from(
        { length: 6 },
        (_, index) =>
          `323e4567-e89b-12d3-a456-42661417400${index}`,
      ),
    }),
  );
});

test("rejects negative stock", () => {
  assert.throws(() =>
    createVendorProductSchema.parse({
      ...validProduct,
      stockonhand: -1,
    }),
  );
});

test("rejects an empty product update", () => {
  assert.throws(() => updateVendorProductSchema.parse({}));
});

test("accepts a partial product update", () => {
  const result = updateVendorProductSchema.parse({
    name: "Vintage Denim Jacket",
    priceamount: "22000.00",
  });

  assert.equal(result.name, "Vintage Denim Jacket");
});

test("accepts an inventory update", () => {
  const result = updateVendorInventorySchema.parse({
    stockonhand: "25",
  });

  assert.equal(result.stockonhand, 25);
});