import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createVendorProductService,
} from "../src/modules/vendors/vendor.product.service.js";

const createdAt = new Date("2026-11-13T10:00:00.000Z");
const categoryId = "123e4567-e89b-12d3-a456-426614174000";
const uploadId = "223e4567-e89b-12d3-a456-426614174000";

function productFixture(overrides = {}) {
  return {
    id: "product-1",
    name: "Vintage Denim",
    description: "Classic denim jacket",
    priceAmount: "20000.00",
    currency: "NGN",
    stockOnHand: 10,
    stockReserved: 2,
    status: "ACTIVE",
    isAvailable: true,
    publishedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    category: {
      id: categoryId,
      name: "Fashion",
      slug: "fashion",
    },
    images: [
      {
        id: "image-1",
        storageKey: "sumasify/products/denim",
        url: "https://cdn.example.com/denim.jpg",
        altText: "Vintage Denim",
        position: 0,
        width: 1200,
        height: 1200,
        bytes: 240000,
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
    findCategoryById: mock.fn(
      overrides.findCategoryById ??
        (async () => ({
          id: categoryId,
          name: "Fashion",
          slug: "fashion",
          isActive: true,
        })),
    ),
    findVendorProducts: mock.fn(
      overrides.findVendorProducts ??
        (async () => [productFixture()]),
    ),
    countVendorProducts: mock.fn(
      overrides.countVendorProducts ?? (async () => 1),
    ),
    findVendorProductById: mock.fn(
      overrides.findVendorProductById ??
        (async () => productFixture()),
    ),
    createVendorProductTransaction: mock.fn(
      overrides.createVendorProductTransaction ??
        (async () => productFixture()),
    ),
    updateVendorProductTransaction: mock.fn(
      overrides.updateVendorProductTransaction ??
        (async () => productFixture()),
    ),
    updateVendorProductInventory: mock.fn(
      overrides.updateVendorProductInventory ??
        (async () => ({
          id: "product-1",
          stockOnHand: 25,
          stockReserved: 3,
        })),
    ),
  };

  return {
    service: createVendorProductService(deps),
    ...deps,
  };
}

const createData = {
  name: "Vintage Denim",
  description: "Classic denim jacket",
  priceamount: "20000.00",
  categoryid: categoryId,
  stockonhand: 10,
  imageids: [uploadId],
};

test("lists only the authenticated vendor's products", async () => {
  const { service, findVendorProducts } = createService();

  const result = await service.listProducts({
    userId: "user-1",
    status: "ACTIVE",
    page: 2,
    pageSize: 10,
  });

  assert.equal(result.data[0].status, "active");
  assert.equal(result.data[0].availablestock, 8);
  assert.equal(result.data[0].images[0].storagekey, "sumasify/products/denim");
  assert.deepEqual(result.meta, {
    page: 2,
    pagesize: 10,
    total: 1,
    totalpages: 1,
  });
  assert.deepEqual(
    findVendorProducts.mock.calls[0].arguments[0],
    {
      vendorId: "vendor-1",
      status: "ACTIVE",
      skip: 10,
      take: 10,
    },
  );
});

test("rejects product access for a non-approved vendor", async () => {
  const { service } = createService({
    findVendorByUserId: async () => null,
  });

  await assert.rejects(
    () =>
      service.listProducts({
        userId: "user-1",
        page: 1,
        pageSize: 20,
      }),
    (error) => error.code === "VENDOR_NOT_APPROVED",
  );
});

test("rejects product access for an inactive vendor", async () => {
  const { service } = createService({
    findVendorByUserId: async () => ({
      id: "vendor-1",
      status: "SUSPENDED",
    }),
  });

  await assert.rejects(
    () =>
      service.listProducts({
        userId: "user-1",
        page: 1,
        pageSize: 20,
      }),
    (error) => error.code === "VENDOR_INACTIVE",
  );
});

test("creates a product for the authenticated vendor", async () => {
  const { service, createVendorProductTransaction } =
    createService();

  const result = await service.createProduct({
    userId: "user-1",
    data: createData,
  });

  assert.equal(result.data.id, "product-1");
  const payload =
    createVendorProductTransaction.mock.calls[0].arguments[0];

  assert.equal(payload.vendorId, "vendor-1");
  assert.deepEqual(payload.imageIds, [uploadId]);
  assert.equal(payload.data.categoryid, categoryId);
});

test("rejects an unknown category", async () => {
  const { service, createVendorProductTransaction } =
    createService({
      findCategoryById: async () => null,
    });

  await assert.rejects(
    () =>
      service.createProduct({
        userId: "user-1",
        data: createData,
      }),
    (error) => error.code === "CATEGORY_NOT_FOUND",
  );
  assert.equal(
    createVendorProductTransaction.mock.callCount(),
    0,
  );
});

test("rejects an inactive category", async () => {
  const { service } = createService({
    findCategoryById: async () => ({
      id: categoryId,
      isActive: false,
    }),
  });

  await assert.rejects(
    () =>
      service.createProduct({
        userId: "user-1",
        data: createData,
      }),
    (error) => error.code === "CATEGORY_INACTIVE",
  );
});

test("does not update another vendor's product", async () => {
  const { service, updateVendorProductTransaction } =
    createService({
      findVendorProductById: async () => null,
    });

  await assert.rejects(
    () =>
      service.updateProduct({
        userId: "user-1",
        productId: "product-1",
        data: { name: "Stolen Product" },
      }),
    (error) => error.code === "PRODUCT_NOT_FOUND",
  );
  assert.equal(
    updateVendorProductTransaction.mock.callCount(),
    0,
  );
});

test("updates a product owned by the vendor", async () => {
  const { service, updateVendorProductTransaction } =
    createService();

  const result = await service.updateProduct({
    userId: "user-1",
    productId: "product-1",
    data: {
      name: "Vintage Denim Jacket",
      priceamount: "22000.00",
      imageids: [uploadId],
    },
  });

  assert.equal(result.data.name, "Vintage Denim");
  assert.deepEqual(
    updateVendorProductTransaction.mock.calls[0].arguments[0],
    {
      productId: "product-1",
      vendorId: "vendor-1",
      data: {
        name: "Vintage Denim Jacket",
        priceamount: "22000.00",
        imageids: [uploadId],
      },
      imageIds: [uploadId],
      now: updateVendorProductTransaction.mock.calls[0]
        .arguments[0].now,
    },
  );
});

test("returns inventory with available stock", async () => {
  const { service, updateVendorProductInventory } =
    createService();

  const result = await service.updateInventory({
    userId: "user-1",
    productId: "product-1",
    stockonhand: 25,
  });

  assert.deepEqual(result, {
    data: {
      productid: "product-1",
      stockonhand: 25,
      stockreserved: 3,
      availablestock: 22,
    },
  });
  assert.deepEqual(
    updateVendorProductInventory.mock.calls[0].arguments[0],
    {
      productId: "product-1",
      vendorId: "vendor-1",
      stockOnHand: 25,
    },
  );
});

test("propagates stock-below-reserved conflicts", async () => {
  const { service } = createService({
    updateVendorProductInventory: async () => {
      const error = new Error("below reserved");
      error.status = 409;
      error.code = "STOCK_BELOW_RESERVED";
      throw error;
    },
  });

  await assert.rejects(
    () =>
      service.updateInventory({
        userId: "user-1",
        productId: "product-1",
        stockonhand: 1,
      }),
    (error) => error.code === "STOCK_BELOW_RESERVED",
  );
});