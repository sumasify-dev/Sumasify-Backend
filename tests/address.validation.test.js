import test from "node:test";
import assert from "node:assert/strict";

import { createAddressSchema } from "../src/modules/addresses/address.validation.js";

const validAddress = {
  label: "Home",
  recipientname: "Ada Obi",
  phone: "08012345678",
  areacode: "400001",
  addressline: "12 University Road",
  instructions: "Call on arrival",
};

test("accepts a valid address and defaults isdefault to false", () => {
  const result = createAddressSchema.parse(validAddress);

  assert.equal(result.recipientname, "Ada Obi");
  assert.equal(result.isdefault, false);
});

test("accepts an explicit default flag", () => {
  const result = createAddressSchema.parse({
    ...validAddress,
    isdefault: true,
  });

  assert.equal(result.isdefault, true);
});

test("rejects a missing recipient name", () => {
  const input = { ...validAddress };
  delete input.recipientname;

  assert.throws(() => createAddressSchema.parse(input));
});

test("rejects a short address line", () => {
  assert.throws(() =>
    createAddressSchema.parse({
      ...validAddress,
      addressline: "12",
    }),
  );
});

test("trims text fields", () => {
  const result = createAddressSchema.parse({
    ...validAddress,
    recipientname: "  Ada Obi  ",
    addressline: "  12 University Road  ",
  });

  assert.equal(result.recipientname, "Ada Obi");
  assert.equal(result.addressline, "12 University Road");
});