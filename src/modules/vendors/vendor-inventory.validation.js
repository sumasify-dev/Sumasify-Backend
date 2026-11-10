import { z } from "zod";

// Validate the product ID in the route parameter.
export const updateVendorInventoryParamsSchema = z.object({
  productid: z.string().uuid("Invalid product ID"),
});

// Validate the requested stock quantity.
export const updateVendorInventoryBodySchema = z
  .object({
    stockonhand: z
      .number()
      .int("Stock quantity must be a whole number")
      .min(0, "Stock cannot be negative"),
  })
  .strict();