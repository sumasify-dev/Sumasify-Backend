import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createVendorProfileService,
} from "../src/modules/vendors/vendor.profile.service.js";

const createdAt = new Date("2026-11-13T10:00:00.000Z");

function vendorFixture(overrides = {}) {
  return {
    id: "vendor-1",
    businessName: "Kemi's Store",
    slug: "kemis-store",
    contactPhone: "2348012345678",
    pickupAddress: "Nsukka",
    deliveryNotes: "Delivery available around campus",
    status: "ACTIVE",
    approvedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createService(overrides = {}) {
  const findVendorByUserId = mock.fn(
    overrides.findVendorByUserId ?? (async () => vendorFixture()),
  );
  const updateVendorById = mock.fn(
    overrides.updateVendorById ??
      (async (vendorId, data) =>
        vendorFixture({
          id: vendorId,
          ...data,
        })),
  );

  const service = createVendorProfileService({
    findVendorByUserId,
    updateVendorById,
  });

  return {
    service,
    findVendorByUserId,
    updateVendorById,
  };
}

test("returns the active vendor's profile", async () => {
  const { service } = createService();

  const result = await service.getProfile({ userId: "user-1" });

  assert.equal(result.data.id, "vendor-1");
  assert.equal(result.data.businessname, "Kemi's Store");
  assert.equal(result.data.status, "active");
  assert.equal(result.data.pickupaddress, "Nsukka");
});

test("rejects a user without a vendor profile", async () => {
  const { service } = createService({
    findVendorByUserId: async () => null,
  });

  await assert.rejects(
    () => service.getProfile({ userId: "user-1" }),
    (error) =>
      error.status === 403 && error.code === "VENDOR_NOT_APPROVED",
  );
});

test("rejects an inactive vendor", async () => {
  const { service } = createService({
    findVendorByUserId: async () =>
      vendorFixture({ status: "SUSPENDED" }),
  });

  await assert.rejects(
    () => service.getProfile({ userId: "user-1" }),
    (error) =>
      error.status === 403 && error.code === "VENDOR_INACTIVE",
  );
});

test("updates only the permitted vendor-owned fields", async () => {
  const { service, updateVendorById } = createService();

  const result = await service.updateProfile({
    userId: "user-1",
    data: {
      businessname: "Kemi's Fashion",
      contactphone: "08012345678",
      pickupaddress: "Nsukka Main Market",
      deliverynotes: "Campus only",
    },
  });

  assert.equal(result.data.businessname, "Kemi's Fashion");
  assert.deepEqual(
    updateVendorById.mock.calls[0].arguments,
    [
      "vendor-1",
      {
        businessName: "Kemi's Fashion",
        contactPhone: "2348012345678",
        pickupAddress: "Nsukka Main Market",
        deliveryNotes: "Campus only",
      },
    ],
  );
});

test("keeps ownership and approval fields out of the update payload", async () => {
  const { service, updateVendorById } = createService();

  await service.updateProfile({
    userId: "user-1",
    data: {
      businessname: "Kemi's Fashion",
    },
  });

  const payload = updateVendorById.mock.calls[0].arguments[1];

  assert.equal(payload.userId, undefined);
  assert.equal(payload.status, undefined);
  assert.equal(payload.approvedAt, undefined);
  assert.equal(payload.slug, undefined);
});

test("does not update a vendor the user does not own", async () => {
  const { service, updateVendorById } = createService({
    findVendorByUserId: async () => null,
  });

  await assert.rejects(
    () =>
      service.updateProfile({
        userId: "other-user",
        data: { businessname: "Not Mine" },
      }),
    (error) => error.code === "VENDOR_NOT_APPROVED",
  );
  assert.equal(updateVendorById.mock.callCount(), 0);
});