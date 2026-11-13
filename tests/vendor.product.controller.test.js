import test, { mock } from "node:test";
import assert from "node:assert/strict";

import {
  createVendorProductController,
} from "../src/modules/vendors/vendor.product.controller.js";

const productId = "123e4567-e89b-12d3-a456-426614174000";
const categoryId = "223e4567-e89b-12d3-a456-426614174000";

const productResponse = {
  data: {
    id: productId,
    name: "Vintage Denim",
  },
};

const listResponse = {
  data: [productResponse.data],
  meta: {
    page: 1,
    pagesize: 20,
    total: 1,
    totalpages: 1,
  },
};

const inventoryResponse = {
  data: {
    productid: productId,
    stockonhand: 25,
    stockreserved: 3,
    availablestock: 22,
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
  const listProducts = mock.fn(
    overrides.listProducts ?? (async () => listResponse),
  );
  const createProduct = mock.fn(
    overrides.createProduct ?? (async () => productResponse),
  );
  const updateProduct = mock.fn(
    overrides.updateProduct ?? (async () => productResponse),
  );
  const updateInventory = mock.fn(
    overrides.updateInventory ?? (async () => inventoryResponse),
  );

  return {
    controller: createVendorProductController({
      listProducts,
      createProduct,
      updateProduct,
      updateInventory,
    }),
    listProducts,
    createProduct,
    updateProduct,
    updateInventory,
  };
}

test("lists products with parsed filters", async () => {
  const { controller, listProducts } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.list(
    {
      user: { id: "user-1" },
      query: {
        status: "active",
        page: "2",
        pagesize: "10",
      },
    },
    res,
    next,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, listResponse);
  assert.deepEqual(
    listProducts.mock.calls[0].arguments[0],
    {
      userId: "user-1",
      status: "ACTIVE",
      page: 2,
      pageSize: 10,
    },
  );
});

test("creates a product and returns 201", async () => {
  const { controller, createProduct } = createController();
  const req = {
    user: { id: "user-1" },
    body: {
      name: "Vintage Denim",
      description: "Classic denim jacket",
      priceamount: "20000.00",
      categoryid: categoryId,
      stockonhand: 10,
    },
  };

  const res = createResponse();
  const next = mock.fn();

  await controller.create(req, res, next);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, productResponse);
  assert.deepEqual(
    createProduct.mock.calls[0].arguments[0],
    {
      userId: "user-1",
      data: req.body,
    },
  );
});

test("updates a product and passes the path id", async () => {
  const { controller, updateProduct } = createController();
  const req = {
    user: { id: "user-1" },
    params: { productid: productId },
    body: { name: "Vintage Denim Jacket" },
  };

  const res = createResponse();
  const next = mock.fn();

  await controller.update(req, res, next);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    updateProduct.mock.calls[0].arguments[0],
    {
      userId: "user-1",
      productId,
      data: { name: "Vintage Denim Jacket" },
    },
  );
});

test("updates inventory", async () => {
  const { controller, updateInventory } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.inventory(
    {
      user: { id: "user-1" },
      params: { productid: productId },
      body: { stockonhand: 25 },
    },
    res,
    next,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, inventoryResponse);
  assert.deepEqual(
    updateInventory.mock.calls[0].arguments[0],
    {
      userId: "user-1",
      productId,
      stockonhand: 25,
    },
  );
});

test("rejects invalid product input", async () => {
  const { controller, createProduct } = createController();
  const res = createResponse();
  const next = mock.fn();

  await controller.create(
    {
      user: { id: "user-1" },
      body: { name: "X" },
    },
    res,
    next,
  );

  assert.equal(next.mock.callCount(), 1);
  assert.equal(createProduct.mock.callCount(), 0);
});

test("forwards service errors", async () => {
  const serviceError = new Error("product failed");
  const { controller } = createController({
    updateInventory: async () => {
      throw serviceError;
    },
  });

  const res = createResponse();
  const next = mock.fn();

  await controller.inventory(
    {
      user: { id: "user-1" },
      params: { productid: productId },
      body: { stockonhand: 25 },
    },
    res,
    next,
  );

  assert.equal(next.mock.calls[0].arguments[0], serviceError);
});