import {
  findVendorForProductOperations,
  findActiveCategoryById,
  findVendorProducts,
  countVendorProducts,
  findProductById,
  createVendorProduct as createVendorProductRecord,
  updateVendorProduct as updateVendorProductRecord,
} from "./vendor-product.model.js";

import { AppError } from "../../middleware/utils/AppError.js";

// Convert Prisma enum values to the lowercase API convention.
function formatStatus(status) {
  return status.toLowerCase();
}

// Format a product consistently for API responses.
function formatProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: {
      amount: product.priceAmount.toFixed(2),
      currency: product.currency,
    },
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
    status: formatStatus(product.status),
    stockonhand: product.stockOnHand,
    stockreserved: product.stockReserved,
    availablestock: Math.max(
      0,
      product.stockOnHand - product.stockReserved
    ),
    isavailable: product.isAvailable,
    publishedat: product.publishedAt,
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      alttext: image.altText,
      position: image.position,
    })),
    createdat: product.createdAt,
    updatedat: product.updatedAt,
  };
}

// Ensure the authenticated user has an approved, active vendor profile.
async function requireActiveVendor({ userId }) {
  const vendor = await findVendorForProductOperations({ userId });

  if (!vendor || vendor.status !== "ACTIVE" || !vendor.approvedAt) {
    throw new AppError(
      "An approved and active vendor account is required.",
      403,
      "vendor_not_approved"
    );
  }

  return vendor;
}

// GET /vendor/products
export async function getVendorProducts({
  userId,
  page,
  pagesize,
  status,
}) {
  const vendor = await requireActiveVendor({ userId });

  const skip = (page - 1) * pagesize;

  const prismaStatus = status ? status.toUpperCase() : undefined;

  const [products, total] = await Promise.all([
    findVendorProducts({
      vendorId: vendor.id,
      skip,
      take: pagesize,
      status: prismaStatus,
    }),
    countVendorProducts({
      vendorId: vendor.id,
      status: prismaStatus,
    }),
  ]);

  return {
    data: products.map(formatProduct),
    meta: {
      page,
      pagesize,
      total,
      totalpages: Math.ceil(total / pagesize),
    },
  };
}

// POST /vendor/products
export async function createVendorProduct({
  userId,
  name,
  description,
  priceamount,
  categoryid,
  stockonhand,
  imageRecords = [],
}) {
  const vendor = await requireActiveVendor({ userId });

  const category = await findActiveCategoryById({
    categoryId: categoryid,
  });

  if (!category) {
    throw new AppError(
      "Category not found or inactive.",
      404,
      "category_inactive"
    );
  }

  const product = await createVendorProductRecord({
    vendorId: vendor.id,
    categoryId: categoryid,
    name,
    description,
    priceAmount: priceamount,
    stockOnHand: stockonhand,
    imageRecords,
  });

  return {
    data: formatProduct(product),
  };
}

// PATCH /vendor/products/:productid
export async function updateVendorProduct({
  userId,
  productId,
  updates,
}) {
  const vendor = await requireActiveVendor({ userId });

  const product = await findProductById({ productId });

  if (!product) {
    throw new AppError(
      "Product not found.",
      404,
      "not_found"
    );
  }

  if (product.vendorId !== vendor.id) {
    throw new AppError(
      "You do not have permission to update this product.",
      403,
      "forbidden"
    );
  }

  const permittedUpdates = {};

  if (updates.name !== undefined) {
    permittedUpdates.name = updates.name;
  }

  if (updates.description !== undefined) {
    permittedUpdates.description = updates.description;
  }

  if (updates.priceamount !== undefined) {
    permittedUpdates.priceAmount = updates.priceamount;
  }

  if (updates.categoryid !== undefined) {
    const category = await findActiveCategoryById({
      categoryId: updates.categoryid,
    });

    if (!category) {
      throw new AppError(
        "Category not found or inactive.",
        404,
        "category_inactive"
      );
    }

    permittedUpdates.categoryId = updates.categoryid;
  }

  const updatedProduct = await updateVendorProductRecord({
    productId,
    updates: permittedUpdates,
  });

  return {
    data: formatProduct(updatedProduct),
  };
}