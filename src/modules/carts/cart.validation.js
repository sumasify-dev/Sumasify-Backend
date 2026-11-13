import { z } from "zod";

export const productIdSchema = z
  .object({
    productId: z.string().uuid("Invalid product id").optional(),
    productid: z.string().uuid("Invalid product id").optional(),
  })
  .transform((data) => ({
    productId: data.productId ?? data.productid,
  }))
  .refine((data) => Boolean(data.productId), {
    message: "Invalid product id",
  });

export const updateCartItemSchema = z.object({
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(1000, "Quantity is too large"),
});
