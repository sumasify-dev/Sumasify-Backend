import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import {
  listProductsSchema,
  productIdSchema,
} from "./product.validation.js";
import {
  listPublicProducts,
  getPublicProduct,
} from "./product.service.js";

export const listProducts = asyncHandler(async (req, res) => {
  const filters = listProductsSchema.parse(req.query);
  const result = await listPublicProducts(filters);

  res.status(200).json(result);
});

export const getProduct = asyncHandler(async (req, res) => {
  const { productId } = productIdSchema.parse(req.params);
  const product = await getPublicProduct(productId);

  res.status(200).json({
    data: product,
  });
});
