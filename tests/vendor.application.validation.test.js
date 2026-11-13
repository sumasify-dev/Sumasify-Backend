import test from "node:test";
import assert from "node:assert/strict";

import { createVendorApplicationSchema } from "../src/modules/vendors/vendor.application.validation.js";

const validApplication = {
  businessname: "Kemi's Store",
  contactphone: "+2348012345678",
  description: "Fashion and accessories store",
  categorynotes: "Fashion",
};

test("accepts a valid vendor application", () => {
  const result = createVendorApplicationSchema.parse(validApplication);

  assert.equal(result.businessname, "Kemi's Store");
  assert.equal(result.contactphone, "+2348012345678");
});

test("trims application text fields", () => {
  const result = createVendorApplicationSchema.parse({
    ...validApplication,
    businessname: "  Kemi's Store  ",
    description: "  Fashion store  ",
  });

  assert.equal(result.businessname, "Kemi's Store");
  assert.equal(result.description, "Fashion store");
});

test("rejects a missing business name", () => {
  const input = { ...validApplication };
  delete input.businessname;

  assert.throws(() => createVendorApplicationSchema.parse(input));
});

test("rejects a business name that is too short", () => {
  assert.throws(() =>
    createVendorApplicationSchema.parse({
      ...validApplication,
      businessname: "K",
    }),
  );
});

test("rejects a missing or too-short contact phone", () => {
  const input = { ...validApplication };
  delete input.contactphone;

  assert.throws(() => createVendorApplicationSchema.parse(input));
  assert.throws(() =>
    createVendorApplicationSchema.parse({
      ...validApplication,
      contactphone: "12345",
    }),
  );
});