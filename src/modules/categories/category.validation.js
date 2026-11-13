import { z } from "zod";

const categoryName = z
  .string()
  .trim()
  .min(2, "Category name must be at least 2 characters")
  .max(100, "Category name must not exceed 100 characters");

const categorySlug = z
  .string()
  .trim()
  .min(2, "Category slug must be at least 2 characters")
  .max(120, "Category slug must not exceed 120 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Category slug must contain lowercase letters, numbers, and hyphens only"
  );

export const listCategoriesSchema = z.object({
  active: z
    .enum(["true", "false"])
    .optional()
    .default("true")
    .transform((value) => value === "true"),
});

export const createCategorySchema = z
  .object({
    name: categoryName,
    slug: categorySlug.optional(),
    sortOrder: z.coerce
      .number()
      .int("Sort order must be an integer")
      .min(0, "Sort order cannot be negative")
      .optional(),
    sortorder: z.coerce
      .number()
      .int("Sort order must be an integer")
      .min(0, "Sort order cannot be negative")
      .optional(),
  })
  .transform((data) => ({
    name: data.name,
    slug: data.slug,
    sortOrder: data.sortOrder ?? data.sortorder ?? 0,
  }));

export const updateCategorySchema = z
  .object({
    name: categoryName.optional(),
    slug: categorySlug.optional(),
    sortOrder: z.coerce
      .number()
      .int("Sort order must be an integer")
      .min(0, "Sort order cannot be negative")
      .optional(),
    sortorder: z.coerce
      .number()
      .int("Sort order must be an integer")
      .min(0, "Sort order cannot be negative")
      .optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.slug !== undefined ||
      value.sortOrder !== undefined ||
      value.sortorder !== undefined,
    {
      message: "At least one category field must be provided",
    }
  )
  .transform((data) => ({
    ...(data.name !== undefined && { name: data.name }),
    ...(data.slug !== undefined && { slug: data.slug }),
    ...((data.sortOrder !== undefined || data.sortorder !== undefined) && {
      sortOrder: data.sortOrder ?? data.sortorder,
    }),
  }));

const booleanQueryOrBody = z.preprocess((value) => {
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return value;
}, z.boolean());

export const updateCategoryStatusSchema = z
  .object({
    isActive: booleanQueryOrBody.optional(),
    isactive: booleanQueryOrBody.optional(),
  })
  .transform(({ isActive, isactive }) => ({
    isActive: isActive ?? isactive,
  }))
  .refine((value) => value.isActive !== undefined, {
    message: "isActive is required",
  });

export const categoryIdSchema = z
  .object({
    categoryId: z.string().uuid("Invalid category id").optional(),
    categoryid: z.string().uuid("Invalid category id").optional(),
  })
  .transform(({ categoryId, categoryid }) => ({
    categoryId: categoryId ?? categoryid,
  }))
  .refine((value) => value.categoryId !== undefined, {
    message: "categoryId is required",
  });
