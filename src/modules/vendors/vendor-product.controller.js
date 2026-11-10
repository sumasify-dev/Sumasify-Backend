import { asyncHandler } from "../../middleware/utils/asyncHandler.js";

import {
  getVendorProducts,
  createVendorProduct,
  updateVendorProduct,
} from "./vendor-product.service.js";

import {
  vendorProductsQuerySchema,
  createVendorProductBodySchema,
  updateVendorProductParamsSchema,
  updateVendorProductBodySchema,
} from "./vendor-product.validation.js";

// GET /vendor/products
export const getVendorProductsController = asyncHandler(
  async (req, res) => {
    const query = vendorProductsQuerySchema.parse(req.query);

    const result = await getVendorProducts({
      userId: req.user.id,
      ...query,
    });

    return res.status(200).json(result);
  }
);

// POST /vendor/products
export const createVendorProductController = asyncHandler(
  async (req, res) => {
    const body = createVendorProductBodySchema.parse(req.body);

    const result = await createVendorProduct({
      userId: req.user.id,
      name: body.name,
      description: body.description,
      priceamount: body.priceamount,
      categoryid: body.categoryid,
      stockonhand: body.stockonhand,
    });

    return res.status(201).json(result);
  }
);

// PATCH /vendor/products/:productid
export const updateVendorProductController = asyncHandler(
  async (req, res) => {
    const { productid } = updateVendorProductParamsSchema.parse(
      req.params
    );

    const updates = updateVendorProductBodySchema.parse(req.body);

    const result = await updateVendorProduct({
      userId: req.user.id,
      productId: productid,
      updates,
    });

    return res.status(200).json(result);
  }
);