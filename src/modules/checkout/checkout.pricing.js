import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/utils/AppError.js";

const DELIVERY_METHODS = new Set(["DELIVERY", "PICKUP"]);
const LOW_STOCK_THRESHOLD = 5;

export function toDecimal(value) {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }

  return new Prisma.Decimal(String(value));
}

export function formatMoney(value) {
  return toDecimal(value).toFixed(2);
}

export function getAvailableStock(product) {
  return Math.max(0, product.stockOnHand - product.stockReserved);
}

export function calculateCommission(subtotalAmount, commissionRateBps) {
  return toDecimal(subtotalAmount)
    .mul(commissionRateBps)
    .div(10000)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function isProductPurchasable(product) {
  return (
    product.status === "ACTIVE" &&
    product.isAvailable === true &&
    product.vendor?.status === "ACTIVE" &&
    product.category?.isActive !== false
  );
}

function resolveDeliveryMethod({ deliveryPreferences, vendorId }) {
  const preference = deliveryPreferences?.[vendorId];

  if (!preference || typeof preference !== "object") {
    throw new AppError(
      `Delivery preference is required for vendor ${vendorId}`,
      400,
      "INVALID_DELIVERY_PREFERENCE",
    );
  }

  const method =
    typeof preference.method === "string"
      ? preference.method.toUpperCase()
      : null;

  if (!DELIVERY_METHODS.has(method)) {
    throw new AppError(
      `Invalid delivery method for vendor ${vendorId}`,
      400,
      "INVALID_DELIVERY_PREFERENCE",
    );
  }

  return method;
}

/**
 * Build the server-authoritative financial breakdown of a cart.
 *
 * The client never supplies prices, delivery amounts, commission, totals or
 * stock. Everything is derived from the loaded cart and the approved V1
 * commerce configuration.
 */
export function buildCheckoutPricing({
  cart,
  deliveryPreferences,
  config,
}) {
  const cartItems = cart?.items ?? [];

  if (cartItems.length === 0) {
    throw new AppError("Cart is empty", 400, "CART_EMPTY");
  }

  if (
    deliveryPreferences === null ||
    typeof deliveryPreferences !== "object" ||
    Array.isArray(deliveryPreferences)
  ) {
    throw new AppError(
      "Invalid delivery preferences",
      400,
      "INVALID_DELIVERY_PREFERENCE",
    );
  }

  const deliveryFee = toDecimal(config.deliveryFeeAmount);
  const groupsByVendor = new Map();
  const warnings = [];
  let currency = config.currency;

  for (const cartItem of cartItems) {
    const product = cartItem.product;

    if (!product) {
      throw new AppError(
        "A product in the cart is no longer available",
        409,
        "PRODUCT_UNAVAILABLE",
      );
    }

    if (!isProductPurchasable(product)) {
      throw new AppError(
        `${product.name} is no longer available`,
        409,
        "PRODUCT_UNAVAILABLE",
      );
    }

    if (!Number.isInteger(cartItem.quantity) || cartItem.quantity < 1) {
      throw new AppError(
        `Invalid quantity for ${product.name}`,
        400,
        "INVALID_QUANTITY",
      );
    }

    if (product.currency && product.currency !== currency) {
      throw new AppError(
        `Product ${product.name} uses an unsupported currency`,
        409,
        "CURRENCY_MISMATCH",
      );
    }

    const availableStock = getAvailableStock(product);

    if (availableStock <= 0) {
      throw new AppError(
        `${product.name} is out of stock`,
        409,
        "PRODUCT_UNAVAILABLE",
      );
    }

    if (cartItem.quantity > availableStock) {
      throw new AppError(
        `${product.name} has only ${availableStock} item(s) available`,
        409,
        "STOCK_CONFLICT",
      );
    }

    const unitPrice = toDecimal(product.priceAmount);
    const lineTotal = unitPrice.mul(cartItem.quantity);
    const vendorId = product.vendor.id;

    if (!groupsByVendor.has(vendorId)) {
      groupsByVendor.set(vendorId, {
        vendor: {
          id: vendorId,
          businessname: product.vendor.businessName,
        },
        items: [],
      });
    }

    groupsByVendor.get(vendorId).items.push({
      productId: product.id,
      name: product.name,
      quantity: cartItem.quantity,
      unitPrice,
      lineTotal,
      imageUrl: product.images?.[0]?.url ?? null,
    });

    const remainingStock = availableStock - cartItem.quantity;

    if (remainingStock <= LOW_STOCK_THRESHOLD) {
      warnings.push({
        productid: product.id,
        code: "LOW_STOCK",
        message: `${product.name} has ${remainingStock} item(s) left after this order.`,
      });
    }
  }

  for (const vendorId of Object.keys(deliveryPreferences)) {
    if (!groupsByVendor.has(vendorId)) {
      throw new AppError(
        `Delivery preference supplied for a vendor that is not in the cart: ${vendorId}`,
        400,
        "INVALID_DELIVERY_PREFERENCE",
      );
    }
  }

  let subtotalAmount = toDecimal(0);
  let deliveryAmount = toDecimal(0);
  const groups = [];

  for (const [vendorId, group] of groupsByVendor) {
    const deliveryMethod = resolveDeliveryMethod({
      deliveryPreferences,
      vendorId,
    });

    const groupSubtotal = group.items.reduce(
      (total, item) => total.add(item.lineTotal),
      toDecimal(0),
    );
    const groupDelivery =
      deliveryMethod === "DELIVERY" ? deliveryFee : toDecimal(0);
    const commissionAmount = calculateCommission(
      groupSubtotal,
      config.commissionRateBps,
    );
    const payoutAmount = groupSubtotal.sub(commissionAmount);

    subtotalAmount = subtotalAmount.add(groupSubtotal);
    deliveryAmount = deliveryAmount.add(groupDelivery);

    groups.push({
      vendor: group.vendor,
      deliverymethod: deliveryMethod,
      subtotalAmount: groupSubtotal,
      deliveryAmount: groupDelivery,
      commissionAmount,
      payoutAmount,
      items: group.items,
    });
  }

  return {
    currency,
    subtotalAmount,
    deliveryAmount,
    totalAmount: subtotalAmount.add(deliveryAmount),
    groups,
    warnings,
  };
}