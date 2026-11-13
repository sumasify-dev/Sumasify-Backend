import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCheckoutPricing,
  calculateCommission,
  formatMoney,
} from "../src/modules/checkout/checkout.pricing.js";

const config = {
  currency: "NGN",
  commissionRateBps: 500,
  deliveryFeeAmount: "2000.00",
};

function product(overrides = {}) {
  return {
    id: "product-1",
    name: "Vintage Denim",
    priceAmount: "20000.00",
    currency: "NGN",
    stockOnHand: 10,
    stockReserved: 0,
    status: "ACTIVE",
    isAvailable: true,
    vendor: {
      id: "vendor-1",
      businessName: "Kemi's Store",
      status: "ACTIVE",
    },
    category: {
      id: "category-1",
      isActive: true,
    },
    images: [{ url: "https://cdn.example.com/denim.jpg" }],
    ...overrides,
  };
}

function cartWith(items) {
  return {
    items: items.map(({ product: itemProduct, quantity }) => ({
      quantity,
      product: itemProduct,
    })),
  };
}

test("calculates subtotal, delivery, commission and payout per vendor", () => {
  const cart = cartWith([
    { product: product(), quantity: 2 },
    {
      product: product({
        id: "product-2",
        name: "Notebook",
        priceAmount: "5000.00",
        vendor: {
          id: "vendor-2",
          businessName: "Campus Books",
          status: "ACTIVE",
        },
      }),
      quantity: 1,
    },
  ]);

  const pricing = buildCheckoutPricing({
    cart,
    deliveryPreferences: {
      "vendor-1": { method: "DELIVERY" },
      "vendor-2": { method: "PICKUP" },
    },
    config,
  });

  assert.equal(formatMoney(pricing.subtotalAmount), "45000.00");
  assert.equal(formatMoney(pricing.deliveryAmount), "2000.00");
  assert.equal(formatMoney(pricing.totalAmount), "47000.00");
  assert.equal(pricing.groups.length, 2);

  const [first, second] = pricing.groups;

  assert.equal(first.deliverymethod, "DELIVERY");
  assert.equal(formatMoney(first.subtotalAmount), "40000.00");
  assert.equal(formatMoney(first.deliveryAmount), "2000.00");
  assert.equal(formatMoney(first.commissionAmount), "2000.00");
  assert.equal(formatMoney(first.payoutAmount), "38000.00");

  assert.equal(second.deliverymethod, "PICKUP");
  assert.equal(formatMoney(second.subtotalAmount), "5000.00");
  assert.equal(formatMoney(second.deliveryAmount), "0.00");
  assert.equal(formatMoney(second.commissionAmount), "250.00");
  assert.equal(formatMoney(second.payoutAmount), "4750.00");
});

test("rounds commission half-up to two decimal places", () => {
  assert.equal(
    calculateCommission("100.10", 500).toFixed(2),
    "5.01",
  );
});

test("rejects an empty cart", () => {
  assert.throws(
    () =>
      buildCheckoutPricing({
        cart: { items: [] },
        deliveryPreferences: {},
        config,
      }),
    (error) => error.code === "CART_EMPTY" && error.status === 400,
  );
});

test("rejects a missing delivery preference for a cart vendor", () => {
  assert.throws(
    () =>
      buildCheckoutPricing({
        cart: cartWith([{ product: product(), quantity: 1 }]),
        deliveryPreferences: {},
        config,
      }),
    (error) =>
      error.code === "INVALID_DELIVERY_PREFERENCE" &&
      error.status === 400,
  );
});

test("rejects a delivery preference for a vendor outside the cart", () => {
  assert.throws(
    () =>
      buildCheckoutPricing({
        cart: cartWith([{ product: product(), quantity: 1 }]),
        deliveryPreferences: {
          "vendor-1": { method: "DELIVERY" },
          "vendor-unknown": { method: "DELIVERY" },
        },
        config,
      }),
    (error) => error.code === "INVALID_DELIVERY_PREFERENCE",
  );
});

test("rejects an invalid delivery method", () => {
  assert.throws(
    () =>
      buildCheckoutPricing({
        cart: cartWith([{ product: product(), quantity: 1 }]),
        deliveryPreferences: {
          "vendor-1": { method: "COURIER" },
        },
        config,
      }),
    (error) => error.code === "INVALID_DELIVERY_PREFERENCE",
  );
});

test("rejects a quantity above available stock", () => {
  assert.throws(
    () =>
      buildCheckoutPricing({
        cart: cartWith([
          {
            product: product({ stockOnHand: 3, stockReserved: 1 }),
            quantity: 3,
          },
        ]),
        deliveryPreferences: {
          "vendor-1": { method: "DELIVERY" },
        },
        config,
      }),
    (error) => error.code === "STOCK_CONFLICT" && error.status === 409,
  );
});

test("rejects an unavailable or inactive product", () => {
  assert.throws(
    () =>
      buildCheckoutPricing({
        cart: cartWith([
          { product: product({ status: "INACTIVE" }), quantity: 1 },
        ]),
        deliveryPreferences: {
          "vendor-1": { method: "DELIVERY" },
        },
        config,
      }),
    (error) =>
      error.code === "PRODUCT_UNAVAILABLE" && error.status === 409,
  );
});

test("emits a low-stock warning when few units remain", () => {
  const pricing = buildCheckoutPricing({
    cart: cartWith([
      {
        product: product({ stockOnHand: 5, stockReserved: 0 }),
        quantity: 2,
      },
    ]),
    deliveryPreferences: {
      "vendor-1": { method: "PICKUP" },
    },
    config,
  });

  assert.equal(pricing.warnings.length, 1);
  assert.equal(pricing.warnings[0].code, "LOW_STOCK");
  assert.equal(pricing.warnings[0].productid, "product-1");
});