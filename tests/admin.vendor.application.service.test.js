import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createAdminVendorApplicationService,
} from "../src/modules/admin/admin.vendor.application.service.js";

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
    reviewedById: null,
    reviewedAt: null,
    createdAt,
    updatedAt: createdAt,
    user: {
      id: "user-1",
      fullName: "Kemi Obi",
      email: "kemi@example.com",
      vendor: null,
    },
    ...overrides,
  };
}

function approvedApplicationFixture() {
  return applicationFixture({
    status: "APPROVED",
    reviewedById: "admin-1",
    reviewedAt: createdAt,
    user: {
      id: "user-1",
      fullName: "Kemi Obi",
      email: "kemi@example.com",
      vendor: {
        id: "vendor-1",
        status: "ACTIVE",
      },
    },
  });
}

function createService(overrides = {}) {
  const findVendorApplicationsWithUsers = mock.fn(
    overrides.findVendorApplicationsWithUsers ??
      (async () => [applicationFixture()]),
  );
  const countVendorApplications = mock.fn(
    overrides.countVendorApplications ?? (async () => 1),
  );
  const applyVendorApplicationDecision = mock.fn(
    overrides.applyVendorApplicationDecision ??
      (async () => ({
        application: approvedApplicationFixture(),
        vendor: { id: "vendor-1", status: "ACTIVE" },
      })),
  );

  const service = createAdminVendorApplicationService({
    findVendorApplicationsWithUsers,
    countVendorApplications,
    applyVendorApplicationDecision,
  });

  return {
    service,
    findVendorApplicationsWithUsers,
    countVendorApplications,
    applyVendorApplicationDecision,
  };
}

test("lists applications with pagination and normalized DTOs", async () => {
  const { service, findVendorApplicationsWithUsers } =
    createService({
      countVendorApplications: async () => 45,
    });

  const result = await service.listApplications({
    status: "PENDING",
    page: 3,
    pageSize: 20,
  });

  assert.equal(result.data[0].status, "pending");
  assert.equal(result.data[0].businessname, "Kemi's Store");
  assert.equal(result.data[0].user.fullname, "Kemi Obi");
  assert.deepEqual(result.meta, {
    page: 3,
    pagesize: 20,
    total: 45,
    totalpages: 3,
  });
  assert.deepEqual(
    findVendorApplicationsWithUsers.mock.calls[0].arguments[0],
    {
      status: "PENDING",
      skip: 40,
      take: 20,
    },
  );
});

test("approves an application and returns the activated vendor", async () => {
  const { service, applyVendorApplicationDecision } =
    createService();

  const result = await service.decideApplication({
    applicationId: "application-1",
    adminUserId: "admin-1",
    decision: "APPROVED",
    rejectionReason: null,
  });

  assert.equal(result.data.status, "approved");
  assert.equal(result.data.vendor.id, "vendor-1");
  assert.equal(result.data.vendor.status, "active");
  assert.deepEqual(
    applyVendorApplicationDecision.mock.calls[0].arguments[0],
    {
      applicationId: "application-1",
      adminUserId: "admin-1",
      decision: "APPROVED",
      rejectionReason: null,
    },
  );
});

test("rejects an application with a trimmed reason", async () => {
  const rejected = applicationFixture({
    status: "REJECTED",
    rejectionReason: "Insufficient business information.",
    reviewedById: "admin-1",
    reviewedAt: createdAt,
  });

  const { service, applyVendorApplicationDecision } =
    createService({
      applyVendorApplicationDecision: async () => ({
        application: rejected,
        vendor: null,
      }),
    });

  const result = await service.decideApplication({
    applicationId: "application-1",
    adminUserId: "admin-1",
    decision: "REJECTED",
    rejectionReason: "  Insufficient business information.  ",
  });

  assert.equal(result.data.status, "rejected");
  assert.equal(
    result.data.rejectionreason,
    "Insufficient business information.",
  );
  assert.equal(
    applyVendorApplicationDecision.mock.calls[0].arguments[0]
      .rejectionReason,
    "Insufficient business information.",
  );
});

test("requires a rejection reason before touching the database", async () => {
  const { service, applyVendorApplicationDecision } =
    createService();

  await assert.rejects(
    () =>
      service.decideApplication({
        applicationId: "application-1",
        adminUserId: "admin-1",
        decision: "REJECTED",
        rejectionReason: "   ",
      }),
    (error) => error.code === "REJECTION_REASON_REQUIRED",
  );
  assert.equal(
    applyVendorApplicationDecision.mock.callCount(),
    0,
  );
});

test("rejects an invalid decision before touching the database", async () => {
  const { service, applyVendorApplicationDecision } =
    createService();

  await assert.rejects(
    () =>
      service.decideApplication({
        applicationId: "application-1",
        adminUserId: "admin-1",
        decision: "PENDING",
        rejectionReason: null,
      }),
    (error) => error.code === "INVALID_APPLICATION_DECISION",
  );
  assert.equal(
    applyVendorApplicationDecision.mock.callCount(),
    0,
  );
});

test("propagates finalised-application conflicts", async () => {
  const { service } = createService({
    applyVendorApplicationDecision: async () => {
      const error = new Error("already finalised");
      error.status = 409;
      error.code = "VENDOR_APPLICATION_NOT_PENDING";
      throw error;
    },
  });

  await assert.rejects(
    () =>
      service.decideApplication({
        applicationId: "application-1",
        adminUserId: "admin-1",
        decision: "APPROVED",
        rejectionReason: null,
      }),
    (error) => error.code === "VENDOR_APPLICATION_NOT_PENDING",
  );
});