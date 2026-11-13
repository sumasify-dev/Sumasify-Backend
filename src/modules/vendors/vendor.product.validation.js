import { z } from "zod";

const uuid = z.string().uuid("Invalid id");

const productStatuses = ["draft", "active", "inactive", "archived"];

const priceAmount = z
  .string()
  .trim()
  .regex(
    /^\d+(?:\.\d{1,2})?$/,
    "Price must be a non-negative decimal amount",
  )
  .refine(
    (value) => Number(value) > 0,
    "Price must be greater than zero",
  )
  .refine(
    (value) => Number(value) <= 9999999999.99,
    "Price is too large",
  );

const imageIds = z
  .array(uuid)
  .min(1, "At least one image id is required")
  .max(5, "A product cannot have more than 5 images");

const stockOnHand = z.coerce
  .number()
  .int("Stock must be a whole number")
  .min(0, "Stock cannot be negative")
  .max(1000000, "Stock is too large");

export const vendorProductListSchema = z
  .object({
    status: z.preprocess(
      (value) =>
        typeof value === "string"
          ? value.trim().toLowerCase()
          : value,
      z.enum(productStatuses).optional(),
    ),
    page: z.coerce
      .number()
      .int("Page must be a whole number")
      .min(1, "Page must be at least 1")
      .default(1),
    pageSize: z.coerce
      .number()
      .int("Page size must be a whole number")
      .min(1)
      .max(50, "Page size cannot exceed 50")
      .optional(),
    pagesize: z.coerce
      .number()
      .int("Page size must be a whole number")
      .min(1)
      .max(50, "Page size cannot exceed 50")
      .optional(),
  })
  .transform((data) => ({
    status: data.status?.toUpperCase(),
    page: data.page,
    pageSize: data.pageSize ?? data.pagesize ?? 20,
  }));

export const createVendorProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(200, "Product name cannot exceed 200 characters"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(5000, "Description cannot exceed 5000 characters"),
  priceamount: priceAmount,
  categoryid: uuid,
  stockonhand: stockOnHand,
  imageids: imageIds.optional(),
});

export const updateVendorProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Product name must be at least 2 characters")
      .max(200, "Product name cannot exceed 200 characters")
      .optional(),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(5000, "Description cannot exceed 5000 characters")
      .optional(),
    priceamount: priceAmount.optional(),
    categoryid: uuid.optional(),
    imageids: imageIds.optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    "At least one product field must be provided",
  );

export const updateVendorInventorySchema = z.object({
  stockonhand: stockOnHand,
});

export const vendorProductIdSchema = z.object({
  productid: uuid,
});
