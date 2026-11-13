import { AppError } from "../../middleware/utils/AppError.js";
import {
  findPublicProducts,
  findPublicProductById,
} from "./product.model.js";

function toProductDto(product) {
  const stockQuantity = Math.max(
    0,
    product.stockOnHand - product.stockReserved
  );

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
    availability: stockQuantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
    stockQuantity,
    images: product.images.map((image) => ({
      url: image.url,
      alt: image.altText || product.name,
      position: image.position,
    })),
    vendor: {
      id: product.vendor.id,
      businessName: product.vendor.businessName,
      slug: product.vendor.slug,
    },
  };
}

export async function listPublicProducts(filters) {
  const [total, products] = await findPublicProducts(filters);
  const pageSize = filters.pageSize ?? filters.pagesize ?? 20;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: products.map(toProductDto),
    meta: {
      page: filters.page,
      pageSize,
      total,
      totalPages,
    },
  };
}

export async function getPublicProduct(productId) {
  const product = await findPublicProductById(productId);

  if (!product) {
    throw new AppError(
      "Product not found",
      404,
      "NOT_FOUND"
    );
  }

  return toProductDto(product);
}
