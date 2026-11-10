import { z } from "zod";

const productStatusSchema = z.enum([
  "draft",
  "active",
  "inactive",
  "archived",
]);

// GET /vendor/products
export const vendorProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),

  pagesize: z.coerce.number().int().min(1).max(50).default(20),

  status: productStatusSchema.optional(),
});

// POST /vendor/products
export const createVendorProductBodySchema = z
  .object({
    name: z.string().trim().min(1, "Product name is required"),

    description: z.string().trim().min(1, "Description is required"),

    priceamount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid price amount")
      .refine((value) => Number(value) > 0, "Price must be greater than zero"),

    categoryid: z.string().uuid("Invalid category ID"),

    stockonhand: z.number().int().min(0, "Stock cannot be negative"),

    imageids: z
      .array(z.string().uuid("Invalid image ID"))
      .min(1, "At least one product image is required"),
  })
  .strict();

// PATCH /vendor/products/:productid
export const updateVendorProductParamsSchema = z.object({
  productid: z.string().uuid("Invalid product ID"),
});

export const updateVendorProductBodySchema = z
  .object({
    name: z.string().trim().min(1, "Product name cannot be empty").optional(),

    description: z.string().trim().min(1, "Description cannot be empty").optional(),

    priceamount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid price amount")
      .refine((value) => Number(value) > 0, "Price must be greater than zero")
      .optional(),

    categoryid: z.string().uuid("Invalid category ID").optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });