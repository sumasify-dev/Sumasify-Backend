import { AppError } from "../../middleware/utils/AppError.js";
import {
  findCategories,
  findCategoryById,
  createCategoryWithAudit,
  updateCategoryWithAudit,
} from "./category.model.js";

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toCategoryDto(category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
  };
}

function throwUniqueResourceError(error) {
  if (error?.code === "P2002") {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(", ")
      : "category";

    throw new AppError(
      `A category with the same ${target.includes("slug") ? "slug" : "name"} already exists`,
      409,
      "DUPLICATE_RESOURCE"
    );
  }

  throw error;
}

export async function listPublicCategories(query) {
  const categories = await findCategories({ active: query.active });
  return categories.map(toCategoryDto);
}

export async function createAdminCategory(data, adminUserId) {
  const payload = {
    name: data.name,
    slug: data.slug ?? slugify(data.name),
    sortOrder: data.sortOrder ?? data.sortorder ?? 0,
    isActive: true,
  };

  if (!payload.slug) {
    throw new AppError(
      "Category name cannot be converted into a valid slug",
      400,
      "VALIDATION_ERROR"
    );
  }

  try {
    const category = await createCategoryWithAudit(payload, {
      adminUserId,
      action: "CATEGORY_CREATED",
      entityType: "Category",
    });

    return toCategoryDto(category);
  } catch (error) {
    throwUniqueResourceError(error);
  }
}

export async function updateAdminCategory(categoryId, data, adminUserId) {
  const existing = await findCategoryById(categoryId);

  if (!existing) {
    throw new AppError("Category not found", 404, "NOT_FOUND");
  }

  const payload = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.slug !== undefined && { slug: data.slug }),
    ...((data.sortOrder !== undefined || data.sortorder !== undefined) && {
      sortOrder: data.sortOrder ?? data.sortorder,
    }),
  };

  try {
    const updated = await updateCategoryWithAudit(categoryId, payload, {
      adminUserId,
      action: "CATEGORY_UPDATED",
      entityType: "Category",
    });

    if (!updated) {
      throw new AppError("Category not found", 404, "NOT_FOUND");
    }

    return toCategoryDto(updated);
  } catch (error) {
    throwUniqueResourceError(error);
  }
}

export async function updateAdminCategoryStatus(categoryId, isActive, adminUserId) {
  const existing = await findCategoryById(categoryId);

  if (!existing) {
    throw new AppError("Category not found", 404, "NOT_FOUND");
  }

  if (existing.isActive === isActive) {
    return toCategoryDto(existing);
  }

  try {
    const updated = await updateCategoryWithAudit(
      categoryId,
      { isActive },
      {
        adminUserId,
        action: isActive ? "CATEGORY_ACTIVATED" : "CATEGORY_DEACTIVATED",
        entityType: "Category",
      }
    );

    if (!updated) {
      throw new AppError("Category not found", 404, "NOT_FOUND");
    }

    return toCategoryDto(updated);
  } catch (error) {
    throwUniqueResourceError(error);
  }
}
