import { AppError } from "../../middleware/utils/AppError.js";
import { findVendorByUserId } from "./vendor.profile.model.js";
import {
  findVendorProducts,
  countVendorProducts,
  findVendorProductById,
  findCategoryById,
  createVendorProductTransaction,
  updateVendorProductTransaction,
  updateVendorProductInventory,
} from "./vendor.product.model.js";

function formatMoney(amount) {
  return Number(amount).toFixed(2);
}

function toVendorProductDto(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    priceamount: formatMoney(product.priceAmount),
    currency: product.currency,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
    status: product.status.toLowerCase(),
    isavailable: product.isAvailable,
    stockonhand: product.stockOnHand,
    stockreserved: product.stockReserved,
    availablestock: Math.max(
      0,
      product.stockOnHand - product.stockReserved,
    ),
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
      storagekey: image.storageKey,
      alttext: image.altText,
      position: image.position,
      width: image.width,
      height: image.height,
      bytes: image.bytes,
    })),
    publishedat: product.publishedAt,
    createdat: product.createdAt,
    updatedat: product.updatedAt,
  };
}

function toInventoryDto(product) {
  return {
    productid: product.id,
    stockonhand: product.stockOnHand,
    stockreserved: product.stockReserved,
    availablestock: Math.max(
      0,
      product.stockOnHand - product.stockReserved,
    ),
  };
}

function throwImageConflict(error) {
  if (error?.code === "P2002") {
    throw new AppError(
      "The image could not be attached to this product",
      409,
      "IMAGE_CONFLICT",
    );
  }

  throw error;
}

export function createVendorProductService({
  findVendorByUserId,
  findCategoryById,
  findVendorProducts,
  countVendorProducts,
  findVendorProductById,
  createVendorProductTransaction,
  updateVendorProductTransaction,
  updateVendorProductInventory,
}) {
  async function requireActiveVendor(userId) {
    const vendor = await findVendorByUserId(userId);

    if (!vendor) {
      throw new AppError(
        "Only approved vendors can manage products",
        403,
        "VENDOR_NOT_APPROVED",
      );
    }

    if (vendor.status !== "ACTIVE") {
      throw new AppError(
        "This vendor account is not active",
        403,
        "VENDOR_INACTIVE",
      );
    }

    return vendor;
  }

  async function requireActiveCategory(categoryId) {
    const category = await findCategoryById(categoryId);

    if (!category) {
      throw new AppError(
        "Category not found",
        404,
        "CATEGORY_NOT_FOUND",
      );
    }

    if (!category.isActive) {
      throw new AppError(
        "This category is not available",
        409,
        "CATEGORY_INACTIVE",
      );
    }

    return category;
  }

  async function listProducts({ userId, status, page, pageSize }) {
    const vendor = await requireActiveVendor(userId);
    const skip = (page - 1) * pageSize;

    const [products, total] = await Promise.all([
      findVendorProducts({
        vendorId: vendor.id,
        status,
        skip,
        take: pageSize,
      }),
      countVendorProducts({
        vendorId: vendor.id,
        status,
      }),
    ]);

    return {
      data: products.map(toVendorProductDto),
      meta: {
        page,
        pagesize: pageSize,
        total,
        totalpages: Math.ceil(total / pageSize),
      },
    };
  }

  async function createProduct({ userId, data }) {
    const vendor = await requireActiveVendor(userId);
    await requireActiveCategory(data.categoryid);

    try {
      const product = await createVendorProductTransaction({
        vendorId: vendor.id,
        data,
        imageIds: data.imageids ?? [],
        now: new Date(),
      });

      return {
        data: toVendorProductDto(product),
      };
    } catch (error) {
      throwImageConflict(error);
    }
  }

  async function updateProduct({
    userId,
    productId,
    data,
  }) {
    const vendor = await requireActiveVendor(userId);

    const existing = await findVendorProductById({
      productId,
      vendorId: vendor.id,
    });

    if (!existing) {
      throw new AppError(
        "Product not found",
        404,
        "PRODUCT_NOT_FOUND",
      );
    }

    if (data.categoryid !== undefined) {
      await requireActiveCategory(data.categoryid);
    }

    try {
      const product = await updateVendorProductTransaction({
        productId,
        vendorId: vendor.id,
        data,
        imageIds: data.imageids,
        now: new Date(),
      });

      if (!product) {
        throw new AppError(
          "Product not found",
          404,
          "PRODUCT_NOT_FOUND",
        );
      }

      return {
        data: toVendorProductDto(product),
      };
    } catch (error) {
      throwImageConflict(error);
    }
  }

  async function updateInventory({
    userId,
    productId,
    stockonhand,
  }) {
    const vendor = await requireActiveVendor(userId);

    const existing = await findVendorProductById({
      productId,
      vendorId: vendor.id,
    });

    if (!existing) {
      throw new AppError(
        "Product not found",
        404,
        "PRODUCT_NOT_FOUND",
      );
    }

    const product = await updateVendorProductInventory({
      productId,
      vendorId: vendor.id,
      stockOnHand: stockonhand,
    });

    if (!product) {
      throw new AppError(
        "Product not found",
        404,
        "PRODUCT_NOT_FOUND",
      );
    }

    return {
      data: toInventoryDto(product),
    };
  }

  return {
    listProducts,
    createProduct,
    updateProduct,
    updateInventory,
  };
}

const vendorProductService = createVendorProductService({
  findVendorByUserId,
  findCategoryById,
  findVendorProducts,
  countVendorProducts,
  findVendorProductById,
  createVendorProductTransaction,
  updateVendorProductTransaction,
  updateVendorProductInventory,
});

export const {
  listProducts,
  createProduct,
  updateProduct,
  updateInventory,
} = vendorProductService;