import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createVendorOrderController,
} from "../src/modules/vendors/vendor.order.controller.js";

const groupId = "123e4567-e89b-12d3-a456-426614174000";

const orderResponse = {
  data: {
    id: groupId,
    fulfilmentstatus: "new",
  },
};

const listResponse = {
  data: [orderResponse.data],
  meta: {
    page: 1,
    pagesize: 20,
    total: 1,
    totalpages: 1,
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
  const listOrders = mock.fn(
    overrides.listOrders ?? (async () => listResponse),
  );
  const getOrder = mock.fn(
    overrides.getOrder ?? (async () => orderResponse),
  );
  const updateOrderStatus = mock.fn(
    overrides.updateOrderStatus ?? (async () => orderResponse),
  );

  return {
    controller: createVendorOrderController({
      listOrders,
      getOrder,
      updateOrderStatus,
    }),
    listOrders,
    getOrder,
    updateOrderStatus,
  };
}

test("lists vendor orders with parsed filters", async () => {
  const { controller, listOrders } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.list(
    {
      user: { id: "user-1" },
      query: { status: "new", page: "2", pagesize: "10" },
    },
    res,
    next,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, listResponse);
  assert.deepEqual(
    listOrders.mock.calls[0].arguments[0],
    {
      userId: "user-1",
      status: "NEW",
      page: 2,
      pageSize: 10,
    },
  );
});

test("returns a single vendor order group", async () => {
  const { controller, getOrder } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.get(
    {
      user: { id: "user-1" },
      params: { groupid: groupId },
    },
    res,
    next,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, orderResponse);
  assert.deepEqual(
    getOrder.mock.calls[0].arguments[0],
    {
      userId: "user-1",
      groupId,
    },
  );
});

test("normalizes and forwards a status update", async () => {
  const { controller, updateOrderStatus } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.updateStatus(
    {
      user: { id: "user-1" },
      params: { groupid: groupId },
      body: {
        status: "READY",
        vendornotes: "Order packed and ready for pickup.",
      },
    },
    res,
    next,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    updateOrderStatus.mock.calls[0].arguments[0],
    {
      userId: "user-1",
      groupId,
      status: "READY",
      vendornotes: "Order packed and ready for pickup.",
    },
  );
});

test("rejects an invalid status update", async () => {
  const { controller, updateOrderStatus } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.updateStatus(
    {
      user: { id: "user-1" },
      params: { groupid: groupId },
      body: { status: "PENDING_PAYMENT" },
    },
    res,
    next,
  );

  assert.equal(next.mock.callCount(), 1);
  assert.equal(updateOrderStatus.mock.callCount(), 0);
});

test("forwards service errors", async () => {
  const serviceError = new Error("order failed");
  const { controller } = createController({
    getOrder: async () => {
      throw serviceError;
    },
  });

  const res = createResponse();
  const next = mock.fn();

  await controller.get(
    {
      user: { id: "user-1" },
      params: { groupid: groupId },
    },
    res,
    next,
  );

  assert.equal(next.mock.calls[0].arguments[0], serviceError);
});