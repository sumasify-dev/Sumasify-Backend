import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createAdminVendorApplicationController,
} from "../src/modules/admin/admin.vendor.application.controller.js";

const applicationId = "123e4567-e89b-12d3-a456-426614174000";

const listResponse = {
  data: [],
  meta: {
    page: 1,
    pagesize: 20,
    total: 0,
    totalpages: 0,
  },
};

const decisionResponse = {
  data: {
    id: applicationId,
    status: "approved",
  },
};

function createResponse() {
  return {
    status: mock.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: mock.fn(function (body) {
      this.body = body;
      return this;
    }),
  };
}

function createController(overrides = {}) {
  const listApplications = mock.fn(
    overrides.listApplications ?? (async () => listResponse),
  );
  const decideApplication = mock.fn(
    overrides.decideApplication ?? (async () => decisionResponse),
  );

  return {
    controller: createAdminVendorApplicationController({
      listApplications,
      decideApplication,
    }),
    listApplications,
    decideApplication,
  };
}

test("lists applications with parsed query parameters", async () => {
  const { controller, listApplications } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.list(
    {
      query: {
        page: "2",
        pagesize: "10",
        status: "pending",
      },
    },
    res,
    next,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, listResponse);
  assert.deepEqual(
    listApplications.mock.calls[0].arguments[0],
    {
      status: "PENDING",
      page: 2,
      pageSize: 10,
    },
  );
});

test("passes an approval decision to the service", async () => {
  const { controller, decideApplication } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.decide(
    {
      params: { id: applicationId },
      body: { decision: "approved" },
      user: { id: "admin-1" },
    },
    res,
    next,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, decisionResponse);
  assert.deepEqual(
    decideApplication.mock.calls[0].arguments[0],
    {
      applicationId,
      adminUserId: "admin-1",
      decision: "APPROVED",
      rejectionReason: null,
    },
  );
});

test("passes a rejection reason to the service", async () => {
  const { controller, decideApplication } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.decide(
    {
      params: { id: applicationId },
      body: {
        decision: "rejected",
        rejectionreason: "Insufficient business information.",
      },
      user: { id: "admin-1" },
    },
    res,
    next,
  );

  assert.deepEqual(
    decideApplication.mock.calls[0].arguments[0],
    {
      applicationId,
      adminUserId: "admin-1",
      decision: "REJECTED",
      rejectionReason: "Insufficient business information.",
    },
  );
});

test("rejects a rejection without a reason", async () => {
  const { controller, decideApplication } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.decide(
    {
      params: { id: applicationId },
      body: { decision: "rejected" },
      user: { id: "admin-1" },
    },
    res,
    next,
  );

  assert.equal(next.mock.callCount(), 1);
  assert.equal(decideApplication.mock.callCount(), 0);
});

test("rejects an invalid application id", async () => {
  const { controller, decideApplication } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.decide(
    {
      params: { id: "not-a-uuid" },
      body: { decision: "approved" },
      user: { id: "admin-1" },
    },
    res,
    next,
  );

  assert.equal(next.mock.callCount(), 1);
  assert.equal(decideApplication.mock.callCount(), 0);
});

test("forwards service errors to the error handler", async () => {
  const serviceError = new Error("decision failed");
  const { controller } = createController({
    decideApplication: async () => {
      throw serviceError;
    },
  });

  const res = createResponse();
  const next = mock.fn();

  await controller.decide(
    {
      params: { id: applicationId },
      body: { decision: "approved" },
      user: { id: "admin-1" },
    },
    res,
    next,
  );

  assert.equal(next.mock.calls[0].arguments[0], serviceError);
});