import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createVendorApplicationService,
} from "../src/modules/vendors/vendor.application.service.js";

const createdAt = new Date("2026-11-13T10:00:00.000Z");

function applicationFixture(overrides = {}) {
  return {
    id: "application-1",
    businessName: "Kemi's Store",
    contactPhone: "2348012345678",
    description: "Fashion and accessories store",
    categoryNotes: "Fashion",
    status: "PENDING",
    rejectionReason: null,
    reviewedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createService(overrides = {}) {
  const findPendingApplicationByUserId = mock.fn(
    overrides.findPendingApplicationByUserId ?? (async () => null),
  );
  const findLatestApplicationByUserId = mock.fn(
    overrides.findLatestApplicationByUserId ??
      (async () => applicationFixture()),
  );
  const createVendorApplication = mock.fn(
    overrides.createVendorApplication ??
      (async ({ data }) =>
        applicationFixture({
          businessName: data.businessname,
          contactPhone: data.contactphone,
          description: data.description ?? null,
          categoryNotes: data.categorynotes ?? null,
        })),
  );

  const service = createVendorApplicationService({
    findPendingApplicationByUserId,
    findLatestApplicationByUserId,
    createVendorApplication,
  });

  return {
    service,
    findPendingApplicationByUserId,
    findLatestApplicationByUserId,
    createVendorApplication,
  };
}

test("submits an application and normalizes the contact phone", async () => {
  const { service, createVendorApplication } = createService();

  const result = await service.submitApplication({
    userId: "buyer-1",
    data: {
      businessname: "Kemi's Store",
      contactphone: "08012345678",
      description: "Fashion and accessories store",
      categorynotes: "Fashion",
    },
  });

  assert.equal(result.data.id, "application-1");
  assert.equal(result.data.status, "pending");
  assert.equal(result.data.businessname, "Kemi's Store");
  assert.equal(
    createVendorApplication.mock.calls[0].arguments[0].data
      .contactphone,
    "2348012345678",
  );
  assert.equal(
    createVendorApplication.mock.calls[0].arguments[0].userId,
    "buyer-1",
  );
});

test("rejects a second pending application", async () => {
  const { service, createVendorApplication } = createService({
    findPendingApplicationByUserId: async () =>
      applicationFixture(),
  });

  await assert.rejects(
    () =>
      service.submitApplication({
        userId: "buyer-1",
        data: {
          businessname: "Kemi's Store",
          contactphone: "08012345678",
        },
      }),
    (error) =>
      error.status === 409 &&
      error.code === "VENDOR_APPLICATION_PENDING",
  );
  assert.equal(createVendorApplication.mock.callCount(), 0);
});

test("handles a concurrent pending application at creation time", async () => {
  const { service } = createService({
    createVendorApplication: async () => null,
  });

  await assert.rejects(
    () =>
      service.submitApplication({
        userId: "buyer-1",
        data: {
          businessname: "Kemi's Store",
          contactphone: "08012345678",
        },
      }),
    (error) => error.code === "VENDOR_APPLICATION_PENDING",
  );
});

test("returns the buyer's latest application", async () => {
  const { service } = createService();

  const result = await service.getMyApplication({ userId: "buyer-1" });

  assert.equal(result.data.id, "application-1");
  assert.equal(result.data.status, "pending");
  assert.equal(result.data.rejectionreason, null);
});

test("returns null when the buyer has no application", async () => {
  const { service } = createService({
    findLatestApplicationByUserId: async () => null,
  });

  const result = await service.getMyApplication({ userId: "buyer-1" });

  assert.equal(result.data, null);
});

test("exposes a rejection reason on the latest application", async () => {
  const { service } = createService({
    findLatestApplicationByUserId: async () =>
      applicationFixture({
        status: "REJECTED",
        rejectionReason: "Insufficient business information.",
      }),
  });

  const result = await service.getMyApplication({ userId: "buyer-1" });

  assert.equal(result.data.status, "rejected");
  assert.equal(
    result.data.rejectionreason,
    "Insufficient business information.",
  );
});