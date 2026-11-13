import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createCheckoutService,
  hashCheckoutRequest,
} from "../src/modules/checkout/checkout.service.js";

const config = {
  currency: "NGN",
  orderTimezone: "Africa/Lagos",
  commissionRateBps: 500,
  deliveryFeeAmount: "2000.00",
  stockReservationMinutes: 30,
  platformBank: {
    bankname: "SUMASIFY Bank",
    accountname: "SUMASIFY Ltd",
    accountnumber: "0123456789",
  },
};

const buyerId = "buyer-1";
const addressId = "123e4567-e89b-12d3-a456-426614174000";
const vendorId = "223e4567-e89b-12d3-a456-426614174000";

const address = {
  id: addressId,
  label: "Home",
  recipientName: "Ada Obi",
  phone: "2348012345678",
  areaCode: "400001",
  addressLine: "12 University Road",
  instructions: "Call on arrival",
};

const cart = {
  items: [
    {
      quantity: 2,
      product: {
        id: "product-1",
        name: "Vintage Denim",
        priceAmount: "20000.00",
        currency: "NGN",
        stockOnHand: 10,
        stockReserved: 0,
        status: "ACTIVE",
        isAvailable: true,
        vendor: {
          id: vendorId,
          businessName: "Kemi's Store",
          status: "ACTIVE",
        },
        category: {
          id: "category-1",
          isActive: true,
        },
        images: [{ url: "https://cdn.example.com/denim.jpg" }],
      },
    },
  ],
};

const payment = {
  id: "payment-1",
  method: "BANK_TRANSFER",
  status: "AWAITING_SUBMISSION",
  amount: "42000.00",
};

function orderFixture() {
  return {
    id: "order-1",
    orderNumber: "SUM-20261113-0001",
    status: "AWAITING_PAYMENT",
    paymentStatus: "AWAITING_SUBMISSION",
    currency: "NGN",
    subtotalAmount: "40000.00",
    deliveryAmount: "2000.00",
    totalAmount: "42000.00",
    vendorOrderGroups: [
      {
        id: "group-1",
        groupNumber: 1,
        vendor: {
          id: vendorId,
          businessName: "Kemi's Store",
        },
        subtotalAmount: "40000.00",
        deliveryAmount: "2000.00",
        commissionAmount: "2000.00",
        payoutAmount: "38000.00",
        fulfilmentStatus: "PENDING_PAYMENT",
        deliveryMethod: "DELIVERY",
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
      },
    ],
    payments: [payment],
  };
}

function createDeps(overrides = {}) {
  return {
    findCartForCheckout: mock.fn(async () => cart),
    findAddressForCheckout: mock.fn(async () => address),
    findCheckoutByIdempotencyKey: mock.fn(async () => null),
    createCheckoutTransaction: mock.fn(async () => ({
      order: orderFixture(),
      payment,
    })),
    ...overrides,
  };
}

const request = {
  buyerId,
  addressid: addressId,
  deliverypreferences: {
    [vendorId]: { method: "DELIVERY" },
  },
};

test("preview returns server-calculated totals and vendor groups", async () => {
  const deps = createDeps();
  const service = createCheckoutService({ ...deps, config });

  const result = await service.previewCheckout(request);

  assert.equal(result.data.currency, "NGN");
  assert.equal(result.data.subtotalamount, "40000.00");
  assert.equal(result.data.deliveryamount, "2000.00");
  assert.equal(result.data.totalamount, "42000.00");
  assert.equal(result.data.vendorgroups.length, 1);
  assert.equal(
    result.data.vendorgroups[0].vendor.businessname,
    "Kemi's Store",
  );
  assert.equal(result.data.vendorgroups[0].deliverymethod, "DELIVERY");
  assert.equal(
    result.data.vendorgroups[0].items[0].linetotalamount,
    "40000.00",
  );
  assert.deepEqual(result.data.warnings, []);
  assert.equal(deps.createCheckoutTransaction.mock.callCount(), 0);
});

test("preview rejects an address the buyer does not own", async () => {
  const deps = createDeps({
    findAddressForCheckout: mock.fn(async () => null),
  });
  const service = createCheckoutService({ ...deps, config });

  await assert.rejects(
    () => service.previewCheckout(request),
    (error) => error.code === "INVALID_ADDRESS" && error.status === 400,
  );
});

test("preview rejects an empty cart", async () => {
  const deps = createDeps({
    findCartForCheckout: mock.fn(async () => ({ items: [] })),
  });
  const service = createCheckoutService({ ...deps, config });

  await assert.rejects(
    () => service.previewCheckout(request),
    (error) => error.code === "CART_EMPTY",
  );
});

test("createCheckoutOrder creates the order through the transaction", async () => {
  const deps = createDeps();
  const service = createCheckoutService({ ...deps, config });

  const result = await service.createCheckoutOrder({
    ...request,
    paymentmethod: "BANK_TRANSFER",
    idempotencykey: "checkout-key-1",
  });

  assert.equal(result.data.order.ordernumber, "SUM-20261113-0001");
  assert.equal(result.data.order.status, "AWAITING_PAYMENT");
  assert.equal(result.data.payment.status, "AWAITING_SUBMISSION");
  assert.equal(result.data.payment.amount, "42000.00");
  assert.equal(result.data.paymentinstructions.reference, "SUM-20261113-0001");
  assert.equal(
    result.data.paymentinstructions.accountnumber,
    "0123456789",
  );

  const txArguments =
    deps.createCheckoutTransaction.mock.calls[0].arguments[0];

  assert.equal(txArguments.buyerId, buyerId);
  assert.equal(txArguments.idempotencyKey, "checkout-key-1");
  assert.equal(txArguments.paymentMethod, "BANK_TRANSFER");
  assert.equal(txArguments.config, config);
  assert.equal(txArguments.addressSnapshot.addressid, addressId);
  assert.equal(
    txArguments.addressSnapshot.addressline,
    "12 University Road",
  );
  assert.equal(
    txArguments.pricing.totalAmount.toFixed(2),
    "42000.00",
  );
});

test("createCheckoutOrder replays the original result for the same key and payload", async () => {
  const requestHash = hashCheckoutRequest({
    addressid: addressId,
    deliverypreferences: request.deliverypreferences,
    paymentmethod: "BANK_TRANSFER",
  });

  const deps = createDeps({
    findCheckoutByIdempotencyKey: mock.fn(async () => ({
      idempotencyKey: "checkout-key-1",
      buyerId,
      requestHash,
      order: orderFixture(),
    })),
  });
  const service = createCheckoutService({ ...deps, config });

  const result = await service.createCheckoutOrder({
    ...request,
    paymentmethod: "BANK_TRANSFER",
    idempotencykey: "checkout-key-1",
  });

  assert.equal(result.data.order.id, "order-1");
  assert.equal(deps.createCheckoutTransaction.mock.callCount(), 0);
});

test("createCheckoutOrder rejects a reused key with a different payload", async () => {
  const deps = createDeps({
    findCheckoutByIdempotencyKey: mock.fn(async () => ({
      idempotencyKey: "checkout-key-1",
      buyerId,
      requestHash: "a-different-hash",
      order: orderFixture(),
    })),
  });
  const service = createCheckoutService({ ...deps, config });

  await assert.rejects(
    () =>
      service.createCheckoutOrder({
        ...request,
        paymentmethod: "BANK_TRANSFER",
        idempotencykey: "checkout-key-1",
      }),
    (error) =>
      error.code === "IDEMPOTENCY_KEY_CONFLICT" &&
      error.status === 409,
  );
  assert.equal(deps.createCheckoutTransaction.mock.callCount(), 0);
});

test("createCheckoutOrder rejects a key owned by another buyer", async () => {
  const requestHash = hashCheckoutRequest({
    addressid: addressId,
    deliverypreferences: request.deliverypreferences,
    paymentmethod: "BANK_TRANSFER",
  });

  const deps = createDeps({
    findCheckoutByIdempotencyKey: mock.fn(async () => ({
      idempotencyKey: "checkout-key-1",
      buyerId: "another-buyer",
      requestHash,
      order: orderFixture(),
    })),
  });
  const service = createCheckoutService({ ...deps, config });

  await assert.rejects(
    () =>
      service.createCheckoutOrder({
        ...request,
        paymentmethod: "BANK_TRANSFER",
        idempotencykey: "checkout-key-1",
      }),
    (error) => error.code === "IDEMPOTENCY_KEY_CONFLICT",
  );
});

test("createCheckoutOrder rejects unsupported payment methods", async () => {
  const deps = createDeps();
  const service = createCheckoutService({ ...deps, config });

  await assert.rejects(
    () =>
      service.createCheckoutOrder({
        ...request,
        paymentmethod: "CARD",
        idempotencykey: "checkout-key-1",
      }),
    (error) =>
      error.code === "INVALID_PAYMENT_METHOD" &&
      error.status === 400,
  );
  assert.equal(deps.findCheckoutByIdempotencyKey.mock.callCount(), 0);
});

test("createCheckoutOrder replays a concurrently committed result on P2002", async () => {
  const requestHash = hashCheckoutRequest({
    addressid: addressId,
    deliverypreferences: request.deliverypreferences,
    paymentmethod: "BANK_TRANSFER",
  });

  const findCheckoutByIdempotencyKey = mock.fn();
  findCheckoutByIdempotencyKey.mock.mockImplementationOnce(async () => null);
  findCheckoutByIdempotencyKey.mock.mockImplementationOnce(async () => ({
    idempotencyKey: "checkout-key-1",
    buyerId,
    requestHash,
    order: orderFixture(),
  }));

  const deps = createDeps({
    findCheckoutByIdempotencyKey,
    createCheckoutTransaction: mock.fn(async () => {
      const error = new Error("Unique constraint");
      error.code = "P2002";
      throw error;
    }),
  });
  const service = createCheckoutService({ ...deps, config });

  const result = await service.createCheckoutOrder({
    ...request,
    paymentmethod: "BANK_TRANSFER",
    idempotencykey: "checkout-key-1",
  });

  assert.equal(result.data.order.id, "order-1");
});