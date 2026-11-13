import { z } from "zod";

const uuid = z.string().uuid("Invalid id");

const decimalQuery = z
  .string()
  .trim()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Price must be a non-negative decimal amount")
  .refine((value) => Number(value) <= 9999999999.99, "Price is too large");

export const listProductsSchema = z.object({
  q: z.string().trim().max(100, "Search query is too long").optional(),
  category: z.string().trim().min(1).max(120).optional(),
  vendor: z.string().trim().min(1).max(120).optional(),
  minPrice: decimalQuery.optional(),
  maxPrice: decimalQuery.optional(),
  inStock: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === undefined ? undefined : value === "true"),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  pagesize: z.coerce.number().int().min(1).max(50).optional(),
}).transform((data) => ({
  ...data,
  pageSize: data.pageSize ?? data.pagesize ?? 20,
})).superRefine((value, ctx) => {
  if (value.minPrice !== undefined && value.maxPrice !== undefined) {
    if (Number(value.minPrice) > Number(value.maxPrice)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minPrice"],
        message: "minPrice cannot be greater than maxPrice",
      });
    }
  }
});

export const productIdSchema = z
  .object({
    productId: uuid.optional(),
    productid: uuid.optional(),
  })
  .transform((data) => ({
    productId: data.productId ?? data.productid,
  }))
  .refine((data) => Boolean(data.productId), {
    message: "Invalid product id",
  });
