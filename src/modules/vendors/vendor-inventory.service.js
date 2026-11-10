import {
  findVendorForProductOperations,
} from "./vendor-product.model.js";

import {
  findVendorProductInventory,
  updateVendorProductInventory,
  findUpdatedVendorProductInventory,
} from "./vendor-inventory.model.js";

import { AppError } from "../../middleware/utils/AppError.js";

// Ensure the authenticated user has an approved and active vendor account.
async function requireActiveVendor({ userId }) {
  const vendor = await findVendorForProductOperations({ userId });

  if (!vendor || vendor.status !== "ACTIVE" || !vendor.approvedAt) {
    throw new AppError(
      "Your vendor account is not approved or active",
      403,
      "vendor_not_approved",
    );
  }

  return vendor;
}

// Update a vendor product's available inventory.
export async function updateVendorProductInventoryService({
  userId,
  productId,
  stockOnHand,
}) {
  // 1. Confirm that the user has an approved, active vendor account.
  const vendor = await requireActiveVendor({ userId });

  // 2. Find the product's current inventory.
  const product = await findVendorProductInventory({ productId });

  if (!product) {
    throw new AppError("Product not found", 404, "product_not_found");
  }

  // 3. Ensure the product belongs to this vendor.
  if (product.vendorId !== vendor.id) {
    throw new AppError(
      "You are not allowed to update this product's inventory",
      403,
      "forbidden",
    );
  }

  // 4. Prevent stock from being reduced below reserved stock.
  if (stockOnHand < product.stockReserved) {
    throw new AppError(
      "Stock cannot be lower than the quantity already reserved",
      409,
      "stock_below_reserved",
    );
  }

  // 5. Perform an atomic update.
  const result = await updateVendorProductInventory({
    productId,
    vendorId: vendor.id,
    stockOnHand,
  });

  // 6. Handle a possible concurrent inventory change.
  if (result.count === 0) {
    const latestProduct = await findVendorProductInventory({ productId });

    if (!latestProduct) {
      throw new AppError("Product not found", 404, "product_not_found");
    }

    if (latestProduct.vendorId !== vendor.id) {
      throw new AppError("Forbidden", 403, "forbidden");
    }

    if (stockOnHand < latestProduct.stockReserved) {
      throw new AppError(
        "Stock cannot be lower than the quantity already reserved",
        409,
        "stock_below_reserved",
      );
    }

    throw new AppError(
      "Inventory could not be updated. Please try again",
      409,
      "inventory_update_conflict",
    );
  }

  // 7. Retrieve the updated inventory.
  const updatedProduct = await findUpdatedVendorProductInventory({
    productId,
  });

  if (!updatedProduct) {
    throw new AppError("Product not found", 404, "product_not_found");
  }

  // 8. Return the updated inventory.
  return {
    data: {
      productid: updatedProduct.id,
      stockonhand: updatedProduct.stockOnHand,
      stockreserved: updatedProduct.stockReserved,
      availablestock: Math.max(
        0,
        updatedProduct.stockOnHand - updatedProduct.stockReserved,
      ),
    },
  };
}