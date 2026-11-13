import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createVendorOrderService,
} from "../src/modules/vendors/vendor.order.service.js";
import {
  deriveParentOrderStatus,
  NEXT_FULFILMENT_STATUS,
} from "../src/modules/vendors/vendor.order.model.js";

const createdAt = new Date("2026-11-13T10:00:00.000Z");

function groupFixture(overrides = {}) {
  return {
    id: "group-1",
    groupNumber: 1,
    subtotalAmount: "40000.00",
    deliveryAmount: "2000.00",
    commissionAmount: "2000.00",
    payoutAmount: "38000.00",
    fulfilmentStatus: "NEW",
    deliveryMethod: "DELIVERY",
    settlementStatus: "PENDING",
    vendorNotes: null,
    createdAt,
    updatedAt: createdAt,
    order: {
      id: "order-1",
      orderNumber: "SUM-20261113-0001",
      status: "PAID",
      paymentStatus: "VERIFIED",
      deliveryAddressSnapshot: {
        recipientname: "Ada Obi",
        phone: "2348012345678",
        addressline: "12 University Road",
      },
      placedAt: createdAt,
    },
    orderItems: [
      {
        id: "item-1",
        productId: "product-1",
        productNameSnapshot: "Vintage Denim",
        unitPriceAmount: "20000.00",
        quantity: 2,
        lineTotalAmount: "40000.00",
        imageUrlSnapshot: "https://cdn.example.com/denim.jpg",
        vendorNameSnapshot: "Kemi's Store",
      },
    ],
    ...overrides,
  };
}

function createService(overrides = {}) {
  const deps = {
    findVendorByUserId: mock.fn(
      overrides.findVendorByUserId ??
        (async () => ({ id: "vendor-1", status: "ACTIVE" })),
    ),
    findVendorOrders: mock.fn(
      overrides.findVendorOrders ??
        (async () => [groupFixture()]),
    ),
    countVendorOrders: mock.fn(
      overrides.countVendorOrders ?? (async () => 1),
    ),
    findVendorOrderById: mock.fn(
      overrides.findVendorOrderById ??
        (async () => groupFixture()),
    ),
    updateVendorOrderStatus: mock.fn(
      overrides.updateVendorOrderStatus ??
        (async () =>
          groupFixture({ fulfilmentStatus: "CONFIRMED" })),
    ),
  };

  return {
    service: createVendorOrderService(deps),
    ...deps,
  };
}

test("lists only the authenticated vendor's order groups", async () => {
  const { service, findVendorOrders } = createService();

  const result = await service.listOrders({
    userId: "user-1",
    status: "NEW",
    page: 1,
    pageSize: 20,
  });

  assert.equal(result.data[0].fulfilmentstatus, "new");
  assert.equal(result.data[0].deliverymethod, "delivery");
  assert.equal(
    result.data[0].deliverysnapshot.recipientname,
    "Ada Obi",
  );
  assert.equal(result.data[0].items[0].linetotalamount, "40000.00");
  assert.deepEqual(result.meta, {
    page: 1,
    pagesize: 20,
    total: 1,
    totalpages: 1,
  });
  assert.deepEqual(
    findVendorOrders.mock.calls[0].arguments[0],
    {
      vendorId: "vendor-1",
      status: "NEW",
      skip: 0,
      take: 20,
    },
  );
});

test("rejects vendor order access for a non-approved vendor", async () => {
  const { service } = createService({
    findVendorByUserId: async () => null,
  });

  await assert.rejects(
    () =>
      service.listOrders({
        userId: "user-1",
        page: 1,
        pageSize: 20,
      }),
    (error) => error.code === "VENDOR_NOT_APPROVED",
  );
});

test("rejects vendor order access for an inactive vendor", async () => {
  const { service } = createService({
    findVendorByUserId: async () => ({
      id: "vendor-1",
      status: "INACTIVE",
    }),
  });

  await assert.rejects(
    () =>
      service.getOrder({
        userId: "user-1",
        groupId: "group-1",
      }),
    (error) => error.code === "VENDOR_INACTIVE",
  );
});

test("does not expose another vendor's order group", async () => {
  const { service, updateVendorOrderStatus } = createService({
    findVendorOrderById: async () => null,
  });

  await assert.rejects(
    () =>
      service.updateOrderStatus({
        userId: "user-1",
        groupId: "group-1",
        status: "CONFIRMED",
      }),
    (error) => error.code === "VENDOR_ORDER_NOT_FOUND",
  );
  assert.equal(updateVendorOrderStatus.mock.callCount(), 0);
});

test("advances fulfilment with optional vendor notes", async () => {
  const { service, updateVendorOrderStatus } = createService();

  const result = await service.updateOrderStatus({
    userId: "user-1",
    groupId: "group-1",
    status: "CONFIRMED",
    vendornotes: "Accepted, preparing order.",
  });

  assert.equal(result.data.fulfilmentstatus, "confirmed");
  assert.deepEqual(
    updateVendorOrderStatus.mock.calls[0].arguments[0],
    {
      groupId: "group-1",
      vendorId: "vendor-1",
      status: "CONFIRMED",
      vendorNotes: "Accepted, preparing order.",
    },
  );
});

test("propagates invalid fulfilment transitions", async () => {
  const { service } = createService({
    updateVendorOrderStatus: async () => {
      const error = new Error("invalid transition");
      error.status = 409;
      error.code = "INVALID_FULFILMENT_TRANSITION";
      throw error;
    },
  });

  await assert.rejects(
    () =>
      service.updateOrderStatus({
        userId: "user-1",
        groupId: "group-1",
        status: "DELIVERED",
      }),
    (error) => error.code === "INVALID_FULFILMENT_TRANSITION",
  );
});

test("only allows the next fulfilment status", () => {
  assert.equal(NEXT_FULFILMENT_STATUS.NEW, "CONFIRMED");
  assert.equal(NEXT_FULFILMENT_STATUS.CONFIRMED, "READY");
  assert.equal(
    NEXT_FULFILMENT_STATUS.READY,
    "OUT_FOR_DELIVERY",
  );
  assert.equal(
    NEXT_FULFILMENT_STATUS.OUT_FOR_DELIVERY,
    "DELIVERED",
  );
  assert.equal(NEXT_FULFILMENT_STATUS.DELIVERED, "COMPLETED");
  assert.equal(NEXT_FULFILMENT_STATUS.PENDING_PAYMENT, undefined);
});

test("derives parent order status from group states", () => {
  assert.equal(deriveParentOrderStatus(["NEW"]), null);
  assert.equal(
    deriveParentOrderStatus(["NEW", "CONFIRMED"]),
    "IN_FULFILMENT",
  );
  assert.equal(
    deriveParentOrderStatus(["DELIVERED", "COMPLETED"]),
    "COMPLETED",
  );
  assert.equal(
    deriveParentOrderStatus(["DELIVERED", "NEW"]),
    "IN_FULFILMENT",
  );
});