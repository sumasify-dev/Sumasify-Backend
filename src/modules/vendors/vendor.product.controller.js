import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import {
  vendorProductListSchema,
  createVendorProductSchema,
  updateVendorProductSchema,
  updateVendorInventorySchema,
  vendorProductIdSchema,
} from "./vendor.product.validation.js";
import {
  listProducts,
  createProduct,
  updateProduct,
  updateInventory,
} from "./vendor.product.service.js";

export function createVendorProductController({
  listProducts,
  createProduct,
  updateProduct,
  updateInventory,
}) {
  const list = asyncHandler(async (req, res) => {
    const query = vendorProductListSchema.parse(req.query);

    const result = await listProducts({
      userId: req.user.id,
      ...query,
    });

    res.status(200).json(result);
  });

  const create = asyncHandler(async (req, res) => {
    const data = createVendorProductSchema.parse(req.body);

    const result = await createProduct({
      userId: req.user.id,
      data,
    });

    res.status(201).json(result);
  });

  const update = asyncHandler(async (req, res) => {
    const { productid } = vendorProductIdSchema.parse(req.params);
    const data = updateVendorProductSchema.parse(req.body);

    const result = await updateProduct({
      userId: req.user.id,
      productId: productid,
      data,
    });

    res.status(200).json(result);
  });

  const inventory = asyncHandler(async (req, res) => {
    const { productid } = vendorProductIdSchema.parse(req.params);
    const data = updateVendorInventorySchema.parse(req.body);

    const result = await updateInventory({
      userId: req.user.id,
      productId: productid,
      stockonhand: data.stockonhand,
    });

    res.status(200).json(result);
  });

  return {
    list,
    create,
    update,
    inventory,
  };
}

const vendorProductController = createVendorProductController({
  listProducts,
  createProduct,
  updateProduct,
  updateInventory,
});

export const { list, create, update, inventory } =
  vendorProductController;