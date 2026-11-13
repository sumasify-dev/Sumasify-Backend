import test from "node:test";
import assert from "node:assert/strict";

import { updateVendorProfileSchema } from "../src/modules/vendors/vendor.profile.validation.js";

test("accepts all permitted profile fields", () => {
  const result = updateVendorProfileSchema.parse({
    businessname: "Kemi's Store",
    contactphone: "+2348012345678",
    pickupaddress: "Nsukka",
    deliverynotes: "Delivery available around campus",
  });

  assert.equal(result.businessname, "Kemi's Store");
  assert.equal(result.pickupaddress, "Nsukka");
});

test("accepts a partial update", () => {
  const result = updateVendorProfileSchema.parse({
    deliverynotes: "  Campus deliveries only  ",
  });

  assert.equal(result.deliverynotes, "Campus deliveries only");
});

test("rejects an empty update", () => {
  assert.throws(() => updateVendorProfileSchema.parse({}));
});

test("rejects a short business name", () => {
  assert.throws(() =>
    updateVendorProfileSchema.parse({
      businessname: "K",
    }),
  );
});