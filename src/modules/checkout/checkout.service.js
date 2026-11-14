import { randomBytes } from "node:crypto";

import prisma from "../../config/prisma.js";
import { AppError } from "../../middleware/utils/AppError.js";

import {
  findBuyerAddress,
  findBuyerCart,
  findCheckoutByIdempotencyKey,
  runCheckoutTransaction,
} from "./checkout.model.js";

const COMMISSION_BPS = 500;
const BASIS_POINTS = 10000;
const PAYMENT_EXPIRY_MINUTES = 15;
const CURRENCY = "NGN";

function toKobo(value) {
  const text = String(value);
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);

  if (!match) {
    throw new AppError(
      "A monetary value in the database is invalid.",
      500,
      "INVALID_MONETARY_VALUE",
    );
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] || "").padEnd(2, "0"));

  return whole * 100n + fraction;
}

function fromKobo(value) {
  const amount = BigInt(value);
  return `${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`;
}

function commissionFor(subtotalKobo) {
  return (
    (subtotalKobo * BigInt(COMMISSION_BPS) + BigInt(BASIS_POINTS / 2)) /
    BigInt(BASIS_POINTS)
  );
}

function createOrderNumber() {
  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  return `SUM-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function paymentInstructions(orderNumber) {
  return {
    bankName: process.env.SUMASIFY_BANK_NAME || null,
    accountName: process.env.SUMASIFY_ACCOUNT_NAME || null,
    accountNumber: process.env.SUMASIFY_ACCOUNT_NUMBER || null,
    reference: orderNumber,
  };
}

function validateCart(cart) {
  if (!cart?.items?.length) {
    throw new AppError("Your cart is empty.", 400, "EMPTY_CART");
  }

  for (const item of cart.items) {
    const product = item.product;

    if (!product || !product.vendor) {
      throw new AppError(
        "A product in your cart is no longer available.",
        409,
        "PRODUCT_UNAVAILABLE",
      );
    }

    if (
      product.status !== "ACTIVE" ||
      !product.isAvailable ||
      !product.category?.isActive ||
      product.vendor.status !== "ACTIVE"
    ) {
      throw new AppError(
        `${product.name} is currently unavailable.`,
        409,
        "PRODUCT_UNAVAILABLE",
      );
    }

    if (product.currency !== CURRENCY) {
      throw new AppError(
        "All products in checkout must use NGN.",
        409,
        "UNSUPPORTED_CURRENCY",
      );
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new AppError(
        "A cart item has an invalid quantity.",
        400,
        "INVALID_CART_QUANTITY",
      );
    }

    if (product.stockOnHand - product.stockReserved < item.quantity) {
      throw new AppError(
        `Insufficient stock for ${product.name}.`,
        409,
        "INSUFFICIENT_STOCK",
      );
    }
  }
}

function calculateCheckout(cart, deliveryPreferences) {
  validateCart(cart);

  const groups = new Map();

  for (const cartItem of cart.items) {
    const product = cartItem.product;
    const vendor = product.vendor;
    const preference = deliveryPreferences[vendor.id];

    if (!preference) {
      throw new AppError(
        `Choose delivery or pickup for ${vendor.businessName}.`,
        400,
        "DELIVERY_PREFERENCE_REQUIRED",
      );
    }

    if (!groups.has(vendor.id)) {
      groups.set(vendor.id, {
        vendor,
        deliveryMethod: preference.method,
        items: [],
        subtotalKobo: 0n,
        deliveryKobo: 0n,
        commissionKobo: 0n,
        payoutKobo: 0n,
      });
    }

    const group = groups.get(vendor.id);

    if (group.deliveryMethod !== preference.method) {
      throw new AppError(
        "Each vendor must have one delivery preference.",
        400,
        "INVALID_DELIVERY_PREFERENCE",
      );
    }

    const unitPriceKobo = toKobo(product.priceAmount);
    const lineTotalKobo = unitPriceKobo * BigInt(cartItem.quantity);

    group.items.push({
      product,
      quantity: cartItem.quantity,
      unitPriceKobo,
      lineTotalKobo,
    });

    group.subtotalKobo += lineTotalKobo;
  }

  for (const vendorId of Object.keys(deliveryPreferences)) {
    if (!groups.has(vendorId)) {
      throw new AppError(
        "A delivery preference was supplied for a vendor not in your cart.",
        400,
        "INVALID_DELIVERY_PREFERENCE",
      );
    }
  }

  let subtotalKobo = 0n;
  let deliveryKobo = 0n;

  for (const group of groups.values()) {
    if (group.deliveryMethod === "DELIVERY") {
      group.deliveryKobo = toKobo(group.vendor.deliveryFeeAmount ?? 0);
    } else {
      if (!group.vendor.pickupAddress) {
        throw new AppError(
          `${group.vendor.businessName} has not configured a pickup address.`,
          409,
          "PICKUP_UNAVAILABLE",
        );
      }

      group.deliveryKobo = 0n;
    }

    group.commissionKobo = commissionFor(group.subtotalKobo);

    // Delivery is collected for the vendor-managed delivery arrangement.
    // Commission applies only to the product subtotal.
    group.payoutKobo =
      group.subtotalKobo - group.commissionKobo + group.deliveryKobo;

    subtotalKobo += group.subtotalKobo;
    deliveryKobo += group.deliveryKobo;
  }

  return {
    groups: [...groups.values()],
    subtotalKobo,
    deliveryKobo,
    totalKobo: subtotalKobo + deliveryKobo,
  };
}

function formatPreview(calculation) {
  return {
    currency: CURRENCY,
    subtotalAmount: fromKobo(calculation.subtotalKobo),
    deliveryAmount: fromKobo(calculation.deliveryKobo),
    totalAmount: fromKobo(calculation.totalKobo),
    vendorGroups: calculation.groups.map((group) => ({
      vendor: {
        id: group.vendor.id,
        businessName: group.vendor.businessName,
      },
      items: group.items.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unitPriceAmount: fromKobo(item.unitPriceKobo),
        lineTotalAmount: fromKobo(item.lineTotalKobo),
      })),
      subtotalAmount: fromKobo(group.subtotalKobo),
      deliveryAmount: fromKobo(group.deliveryKobo),
      deliveryMethod: group.deliveryMethod,
    })),
    warnings: [],
  };
}

async function existingCheckoutForBuyer(buyerId, key) {
  const payment = await findCheckoutByIdempotencyKey(key);

  if (!payment) return null;

  if (payment.order.buyerId !== buyerId) {
    throw new AppError(
      "This idempotency key has already been used.",
      409,
      "IDEMPOTENCY_KEY_CONFLICT",
    );
  }

  return {
    reused: true,
    order: payment.order,
    payment,
    paymentInstructions: paymentInstructions(payment.order.orderNumber),
  };
}

export async function previewCheckout(buyerId, input) {
  const [address, cart] = await Promise.all([
    findBuyerAddress(buyerId, input.addressId),
    findBuyerCart(buyerId),
  ]);

  if (!address) {
    throw new AppError(
      "The selected address was not found.",
      400,
      "INVALID_ADDRESS",
    );
  }

  const calculation = calculateCheckout(cart, input.deliveryPreferences);

  return formatPreview(calculation);
}

export async function createCheckoutOrder(buyerId, input, idempotencyKey) {
  const existing = await existingCheckoutForBuyer(buyerId, idempotencyKey);

  if (existing) return existing;

  try {
    return await runCheckoutTransaction(async (tx) => {
      const duplicate = await tx.payment.findUnique({
        where: { idempotencyKey },
        include: {
          order: {
            include: {
              vendorOrderGroups: {
                orderBy: { groupNumber: "asc" },
                include: {
                  vendor: {
                    select: { id: true, businessName: true },
                  },
                  orderItems: true,
                },
              },
            },
          },
        },
      });

      if (duplicate) {
        if (duplicate.order.buyerId !== buyerId) {
          throw new AppError(
            "This idempotency key has already been used.",
            409,
            "IDEMPOTENCY_KEY_CONFLICT",
          );
        }

        return {
          reused: true,
          order: duplicate.order,
          payment: duplicate,
          paymentInstructions: paymentInstructions(duplicate.order.orderNumber),
        };
      }

      const address = await tx.address.findFirst({
        where: {
          id: input.addressId,
          userId: buyerId,
        },
      });

      if (!address) {
        throw new AppError(
          "The selected address was not found.",
          400,
          "INVALID_ADDRESS",
        );
      }

      const cart = await findBuyerCart(buyerId, tx);
      const calculation = calculateCheckout(cart, input.deliveryPreferences);

      // The conditional UPDATE is the stock concurrency guard.
      // All stock changes roll back if any subsequent write fails.
      for (const group of calculation.groups) {
        for (const item of group.items) {
          const changed = await tx.$executeRaw`
            UPDATE products
            SET
              stock_reserved = stock_reserved + ${item.quantity},
              updated_at = NOW()
            WHERE
              id = ${item.product.id}
              AND status = 'ACTIVE'
              AND is_available = TRUE
              AND stock_on_hand - stock_reserved >= ${item.quantity}
          `;

          if (changed !== 1) {
            throw new AppError(
              `${item.product.name} no longer has sufficient stock.`,
              409,
              "INSUFFICIENT_STOCK",
            );
          }
        }
      }

      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + PAYMENT_EXPIRY_MINUTES * 60 * 1000,
      );

      const order = await tx.order.create({
        data: {
          orderNumber: createOrderNumber(),
          buyerId,
          currency: CURRENCY,
          subtotalAmount: fromKobo(calculation.subtotalKobo),
          deliveryAmount: fromKobo(calculation.deliveryKobo),
          totalAmount: fromKobo(calculation.totalKobo),
          paymentStatus: "AWAITING_SUBMISSION",
          status: "AWAITING_PAYMENT",
          placedAt: now,
          deliveryAddressSnapshot: {
            recipientName: address.recipientName,
            phone: address.phone,
            areaCode: address.areaCode,
            addressLine: address.addressLine,
            instructions: address.instructions,
          },
        },
      });

      let groupNumber = 1;

      for (const group of calculation.groups) {
        const createdGroup = await tx.vendorOrderGroup.create({
          data: {
            orderId: order.id,
            vendorId: group.vendor.id,
            groupNumber,
            subtotalAmount: fromKobo(group.subtotalKobo),
            deliveryAmount: fromKobo(group.deliveryKobo),
            commissionAmount: fromKobo(group.commissionKobo),
            payoutAmount: fromKobo(group.payoutKobo),
            fulfilmentStatus: "PENDING_PAYMENT",
            deliveryMethod: group.deliveryMethod,
            settlementStatus: "PENDING",
          },
        });

        for (const item of group.items) {
          await tx.orderItem.create({
            data: {
              vendorOrderGroupId: createdGroup.id,
              productId: item.product.id,
              productNameSnapshot: item.product.name,
              unitPriceAmount: fromKobo(item.unitPriceKobo),
              quantity: item.quantity,
              lineTotalAmount: fromKobo(item.lineTotalKobo),
              imageUrlSnapshot: item.product.images[0]?.url ?? null,
              vendorNameSnapshot: group.vendor.businessName,
            },
          });

          await tx.stockReservation.create({
            data: {
              productId: item.product.id,
              orderId: order.id,
              quantity: item.quantity,
              expiresAt,
            },
          });
        }

        groupNumber += 1;
      }

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          method: input.paymentMethod,
          status: "AWAITING_SUBMISSION",
          amount: fromKobo(calculation.totalKobo),
          idempotencyKey,
        },
      });

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      const createdOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          vendorOrderGroups: {
            orderBy: { groupNumber: "asc" },
            include: {
              vendor: {
                select: { id: true, businessName: true },
              },
              orderItems: {
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      return {
        reused: false,
        order: createdOrder,
        payment,
        paymentInstructions: paymentInstructions(order.orderNumber),
      };
    });
  } catch (error) {
    if (error?.code === "P2002" || error?.code === "P2034") {
      const retry = await existingCheckoutForBuyer(buyerId, idempotencyKey);

      if (retry) return retry;
    }

    if (error?.code === "P2034") {
      throw new AppError(
        "Checkout conflicted with another transaction. Please try again.",
        409,
        "CHECKOUT_CONFLICT",
      );
    }

    throw error;
  }
}
