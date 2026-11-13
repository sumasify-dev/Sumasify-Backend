import prisma from "../../config/prisma.js";
import { AppError } from "../../middleware/utils/AppError.js";

const cartInclude = {
  items: {
    orderBy: {
      addedAt: "asc",
    },
    include: {
      product: {
        include: {
          vendor: true,
          category: true,
          images: {
            orderBy: {
              position: "asc",
            },
          },
        },
      },
    },
  },
};

export const checkoutOrderInclude = {
  vendorOrderGroups: {
    orderBy: {
      groupNumber: "asc",
    },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
        },
      },
      orderItems: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  },
  payments: {
    orderBy: {
      createdAt: "desc",
    },
  },
};

export async function findCartForCheckout(buyerId) {
  return prisma.cart.findUnique({
    where: {
      buyerId,
    },
    include: cartInclude,
  });
}

export async function findAddressForCheckout({ addressId, buyerId }) {
  return prisma.address.findFirst({
    where: {
      id: addressId,
      userId: buyerId,
    },
  });
}

export async function findCheckoutByIdempotencyKey(idempotencyKey) {
  return prisma.checkoutIdempotency.findUnique({
    where: {
      idempotencyKey,
    },
    include: {
      order: {
        include: checkoutOrderInclude,
      },
    },
  });
}

export function getOrderDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}${values.month}${values.day}`;
}

async function nextOrderNumber(tx, timeZone) {
  const dateKey = getOrderDateKey(new Date(), timeZone);

  const rows = await tx.$queryRaw`
    INSERT INTO "order_number_counters" ("date_key", "last_number", "updated_at")
    VALUES (${dateKey}, 1, NOW())
    ON CONFLICT ("date_key")
    DO UPDATE SET
      "last_number" = "order_number_counters"."last_number" + 1,
      "updated_at" = NOW()
    RETURNING "last_number"
  `;

  const sequence = Number(rows[0].last_number);

  return `SUM-${dateKey}-${String(sequence).padStart(4, "0")}`;
}

function uniqueTarget(error) {
  if (!error?.code) {
    return "";
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.join(",");
  }

  return String(target ?? "");
}

function isRetryableCollision(error) {
  if (error?.code === "P2034") {
    return true;
  }

  if (error?.code !== "P2002") {
    return false;
  }

  const target = uniqueTarget(error);

  return (
    target.includes("order_number") ||
    target.includes("orderNumber")
  );
}

export async function createCheckoutTransaction({
  buyerId,
  addressSnapshot,
  pricing,
  paymentMethod,
  idempotencyKey,
  requestHash,
  config,
}) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const now = new Date();

        // 1. Reserve stock atomically. The conditional update is the
        //    oversell guard: if another checkout consumed the stock, the
        //    affected-row count is zero and the whole transaction rolls back.
        for (const group of pricing.groups) {
          for (const item of group.items) {
            const affected = await tx.$executeRaw`
              UPDATE "products"
              SET "stock_reserved" = "stock_reserved" + ${item.quantity},
                  "updated_at" = NOW()
              WHERE "id" = ${item.productId}
                AND "status" = 'ACTIVE'
                AND "is_available" = TRUE
                AND "stock_on_hand" - "stock_reserved" >= ${item.quantity}
                AND EXISTS (
                  SELECT 1
                  FROM "vendors"
                  WHERE "vendors"."id" = "products"."vendor_id"
                    AND "vendors"."status" = 'ACTIVE'
                )
            `;

            if (Number(affected) !== 1) {
              throw new AppError(
                `${item.name} is no longer available in the requested quantity`,
                409,
                "STOCK_CONFLICT",
              );
            }
          }
        }

        // 2. Allocate a collision-safe order number.
        const orderNumber = await nextOrderNumber(
          tx,
          config.orderTimezone,
        );

        // 3. Create the parent order.
        const order = await tx.order.create({
          data: {
            orderNumber,
            buyerId,
            currency: pricing.currency,
            subtotalAmount: pricing.subtotalAmount,
            deliveryAmount: pricing.deliveryAmount,
            totalAmount: pricing.totalAmount,
            deliveryAddressSnapshot: addressSnapshot,
            placedAt: now,
          },
        });

        // 4. Create vendor groups and immutable item snapshots.
        let groupNumber = 1;

        for (const group of pricing.groups) {
          await tx.vendorOrderGroup.create({
            data: {
              orderId: order.id,
              vendorId: group.vendor.id,
              groupNumber,
              subtotalAmount: group.subtotalAmount,
              deliveryAmount: group.deliveryAmount,
              commissionAmount: group.commissionAmount,
              payoutAmount: group.payoutAmount,
              fulfilmentStatus: "PENDING_PAYMENT",
              deliveryMethod: group.deliverymethod,
              orderItems: {
                create: group.items.map((item) => ({
                  productId: item.productId,
                  productNameSnapshot: item.name,
                  unitPriceAmount: item.unitPrice,
                  quantity: item.quantity,
                  lineTotalAmount: item.lineTotal,
                  imageUrlSnapshot: item.imageUrl,
                  vendorNameSnapshot: group.vendor.businessname,
                })),
              },
            },
          });

          groupNumber += 1;
        }

        // 5. Create the pending bank-transfer payment.
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            method: paymentMethod,
            status: "AWAITING_SUBMISSION",
            amount: pricing.totalAmount,
            idempotencyKey: `checkout:${idempotencyKey}`,
          },
        });

        // 6. Persist the stock reservations.
        const expiresAt = new Date(
          now.getTime() + config.stockReservationMinutes * 60 * 1000,
        );

        const reservations = pricing.groups.flatMap((group) =>
          group.items.map((item) => ({
            productId: item.productId,
            orderId: order.id,
            quantity: item.quantity,
            expiresAt,
          })),
        );

        await tx.stockReservation.createMany({
          data: reservations,
        });

        // 7. Record checkout idempotency for replay and payload checks.
        await tx.checkoutIdempotency.create({
          data: {
            idempotencyKey,
            buyerId,
            requestHash,
            orderId: order.id,
          },
        });

        // 8. Clear the cart only after everything else succeeded.
        await tx.cartItem.deleteMany({
          where: {
            cart: {
              buyerId,
            },
          },
        });

        const completeOrder = await tx.order.findUnique({
          where: {
            id: order.id,
          },
          include: checkoutOrderInclude,
        });

        return {
          order: completeOrder,
          payment,
        };
      }, {
        maxWait: 5000,
        timeout: 15000,
      });
    } catch (error) {
      if (isRetryableCollision(error) && attempt < maxAttempts) {
        continue;
      }

      throw error;
    }
  }

  throw new AppError(
    "Unable to create order at this time",
    503,
    "ORDER_CREATION_FAILED",
  );
}