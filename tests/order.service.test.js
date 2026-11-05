import test, { mock } from "node:test";
import assert from "node:assert/strict";

import { createOrderService } from "../src/modules/orders/order.service.js";

const findOrdersByBuyerId = mock.fn();
const countOrdersByBuyerId = mock.fn();
const findOrderById = mock.fn();

const {
  getBuyerOrders,
  getOrderById,
} = createOrderService({
  findOrdersByBuyerId,
  countOrdersByBuyerId,
  findOrderById,
});

test.beforeEach(() => {
  findOrdersByBuyerId.mock.resetCalls();
  countOrdersByBuyerId.mock.resetCalls();
  findOrderById.mock.resetCalls();
});

test("returns orders belonging to the specified buyer", async () => {
  const buyerId = "buyer-123";

  const mockOrders = [];

  findOrdersByBuyerId.mock.mockImplementation(async () => {
  return mockOrders;
});

countOrdersByBuyerId.mock.mockImplementation(async () => {
  return 0;
});

  const result = await getBuyerOrders({
    buyerId,
    page: 1,
    pageSize: 20,
  });

  assert.deepEqual(result, {
    data: [],
    meta: {
      page: 1,
      pagesize: 20,
      total: 0,
      totalpages: 0,
    },
  });

  assert.deepEqual(
    findOrdersByBuyerId.mock.calls[0].arguments[0],
    {
      buyerId: "buyer-123",
      status: undefined,
      skip: 0,
      take: 20,
    }
  );

  assert.deepEqual(
    countOrdersByBuyerId.mock.calls[0].arguments[0],
    {
      buyerId: "buyer-123",
      status: undefined,
    }
  );
});

test("calculates pagination correctly", async () => {
  findOrdersByBuyerId.mock.mockImplementation(async () => []);
  countOrdersByBuyerId.mock.mockImplementation(async () => 45);
  const result = await getBuyerOrders({
    buyerId: "buyer-123",
    page: 3,
    pageSize: 20,
  });

  assert.equal(
   findOrdersByBuyerId.mock.calls.at(-1).arguments[0].skip, 40
  );

  assert.equal(
    findOrdersByBuyerId.mock.calls.at(-1).arguments[0].take,
    20
  );

  assert.equal(result.meta.page, 3);
  assert.equal(result.meta.pagesize, 20);
  assert.equal(result.meta.total, 45);
  assert.equal(result.meta.totalpages, 3);
});

test("filters buyer orders by status", async () => {
  findOrdersByBuyerId.mock.mockImplementation(async () => []);
  countOrdersByBuyerId.mock.mockImplementation(async () => 0);

  await getBuyerOrders({
    buyerId: "buyer-123",
    status: "paid",
    page: 1,
    pageSize: 20,
  });

  assert.equal(
    findOrdersByBuyerId.mock.calls[0].arguments[0].status,
    "PAID"
  );

  assert.equal(
    countOrdersByBuyerId.mock.calls[0].arguments[0].status,
    "PAID"
  );
});

test("returns empty results when buyer has no orders", async () => {
  findOrdersByBuyerId.mock.mockImplementation(async () => []);
  countOrdersByBuyerId.mock.mockImplementation(async () => 0);

  const result = await getBuyerOrders({
    buyerId: "buyer-123",
    page: 1,
    pageSize: 20,
  });

  assert.deepEqual(result, {
    data: [],
    meta: {
      page: 1,
      pagesize: 20,
      total: 0,
      totalpages: 0,
    },
  });
});

test("formats order details correctly", async () => {
  findOrdersByBuyerId.mock.mockImplementation(async () => [
    {
      id: "order-123",
      orderNumber: "SUM-2026-001",
      status: "PAID",
      paymentStatus: "VERIFIED",
      currency: "NGN",
      subtotalAmount: 15000,
      deliveryAmount: 1000,
      totalAmount: 16000,
      deliveryAddressSnapshot: null,
      placedAt: new Date("2026-11-05T10:00:00.000Z"),
      cancelledAt: null,
      createdAt: new Date("2026-11-05T10:00:00.000Z"),
      updatedAt: new Date("2026-11-05T10:00:00.000Z"),
      vendorOrderGroups: [
        {
          id: "group-123",
          groupNumber: 1,
          subtotalAmount: 15000,
          deliveryAmount: 1000,
          commissionAmount: 300,
          payoutAmount: 14700,
          fulfilmentStatus: "PENDING",
          deliveryMethod: "DELIVERY",
          vendorNotes: null,
          settlementStatus: "PENDING",
          vendor: {
            id: "vendor-123",
            businessName: "Campus Store",
          },
          orderItems: [
            {
              id: "item-123",
              productId: "product-123",
              productNameSnapshot: "Medical Textbook",
              unitPriceAmount: 15000,
              quantity: 1,
              lineTotalAmount: 15000,
              imageUrlSnapshot: null,
              vendorNameSnapshot: "Campus Store",
              createdAt: new Date("2026-11-05T10:00:00.000Z"),
            },
          ],
        },
      ],
    },
  ]);

  countOrdersByBuyerId.mock.mockImplementation(async () => 1);

  const result = await getBuyerOrders({
    buyerId: "buyer-123",
    page: 1,
    pageSize: 20,
  });

  const order = result.data[0];
  const group = order.vendorgroups[0];
  const item = group.items[0];

  assert.equal(order.ordernumber, "SUM-2026-001");
  assert.equal(order.status, "paid");
  assert.equal(order.paymentstatus, "verified");

  assert.equal(order.subtotalamount, "15000.00");
  assert.equal(order.deliveryamount, "1000.00");
  assert.equal(order.totalamount, "16000.00");

  assert.equal(group.fulfilmentstatus, "pending");
  assert.equal(group.deliverymethod, "delivery");
  assert.equal(group.settlementstatus, "pending");

  assert.equal(group.vendor.businessname, "Campus Store");
  assert.equal(group.commissionamount, "300.00");
  assert.equal(group.payoutamount, "14700.00");

  assert.equal(item.productname, "Medical Textbook");
  assert.equal(item.unitpriceamount, "15000.00");
  assert.equal(item.linetotalamount, "15000.00");
  assert.equal(item.quantity, 1);
});

test("prevents a buyer from accessing another buyer's order", async () => {
  findOrderById.mock.mockImplementation(async () => ({
    id: "order-123",
    buyerId: "buyer-456",
  }));

  await assert.rejects(
    getOrderById({
      orderId: "order-123",
      userId: "buyer-123",
      userRole: "buyer",
    }),
    {
      message: "You are not authorized to access this order",
      status: 403,
      code: "ORDER_FORBIDDEN",
    }
  );
});

test("allows an admin to access another buyer's order", async () => {
  findOrderById.mock.mockImplementation(async () => ({
    id: "order-123",
    buyerId: "buyer-456",
    orderNumber: "SUM-2026-001",
    status: "PAID",
    paymentStatus: "VERIFIED",
    currency: "NGN",
    subtotalAmount: 15000,
    deliveryAmount: 1000,
    totalAmount: 16000,
    deliveryAddressSnapshot: null,
    placedAt: new Date("2026-11-05T10:00:00.000Z"),
    cancelledAt: null,
    createdAt: new Date("2026-11-05T10:00:00.000Z"),
    updatedAt: new Date("2026-11-05T10:00:00.000Z"),
    vendorOrderGroups: [],
  }));

  const result = await getOrderById({
    orderId: "order-123",
    userId: "admin-123",
    userRole: "admin",
  });

  assert.equal(result.id, "order-123");
  assert.equal(result.ordernumber, "SUM-2026-001");
  assert.equal(result.status, "paid");
});

test("returns 404 when an order does not exist", async () => {
  findOrderById.mock.mockImplementation(async () => null);

  await assert.rejects(
    getOrderById({
      orderId: "nonexistent-order",
      userId: "buyer-123",
      userRole: "buyer",
    }),
    {
      message: "Order not found",
      status: 404,
      code: "ORDER_NOT_FOUND",
    }
  );
});