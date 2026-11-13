import prisma from "../../config/prisma.js";
import { AppError } from "../../middleware/utils/AppError.js";
import { deriveOrderStatusAfterPayment } from "../orders/order.service.js";
import { assertPaymentIsDecidable } from "./admin.payment.rules.js";

export function findPaymentForDecision({ paymentId }) {
  return prisma.payment.findUnique({
    where: {
      id: paymentId,
    },
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          buyerId: true,
        },
      },
    },
  });
}

async function releaseReservedStock({ tx, orderId, now }) {
  const reservations = await tx.stockReservation.findMany({
    where: {
      orderId,
      releasedAt: null,
      committedAt: null,
    },
    select: {
      id: true,
      productId: true,
      quantity: true,
    },
  });

  let released = 0;

  for (const reservation of reservations) {
    const claimed = await tx.stockReservation.updateMany({
      where: {
        id: reservation.id,
        releasedAt: null,
        committedAt: null,
      },
      data: {
        releasedAt: now,
      },
    });

    if (claimed.count !== 1) {
      continue;
    }

    await tx.$executeRaw`
      UPDATE "products"
      SET "stock_reserved" = GREATEST(0, "stock_reserved" - ${reservation.quantity}),
          "updated_at" = NOW()
      WHERE "id" = ${reservation.productId}
    `;

    released += 1;
  }

  return released;
}

async function commitReservedStock({ tx, orderId, now }) {
  const reservations = await tx.stockReservation.findMany({
    where: {
      orderId,
      releasedAt: null,
      committedAt: null,
    },
    select: {
      id: true,
      productId: true,
      quantity: true,
    },
  });

  let committed = 0;

  for (const reservation of reservations) {
    const claimed = await tx.stockReservation.updateMany({
      where: {
        id: reservation.id,
        releasedAt: null,
        committedAt: null,
      },
      data: {
        committedAt: now,
      },
    });

    if (claimed.count !== 1) {
      continue;
    }

    const affected = await tx.$executeRaw`
      UPDATE "products"
      SET "stock_on_hand" = "stock_on_hand" - ${reservation.quantity},
          "stock_reserved" = "stock_reserved" - ${reservation.quantity},
          "updated_at" = NOW()
      WHERE "id" = ${reservation.productId}
        AND "stock_on_hand" >= ${reservation.quantity}
        AND "stock_reserved" >= ${reservation.quantity}
    `;

    if (Number(affected) !== 1) {
      throw new AppError(
        "Reserved stock could not be committed for this order",
        409,
        "STOCK_RESERVATION_CONFLICT",
      );
    }

    committed += 1;
  }

  return committed;
}

export async function applyPaymentDecision({
  paymentId,
  adminUserId,
  decision,
  rejectionReason,
}) {
  return prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.findUnique({
        where: {
          id: paymentId,
        },
        include: {
          order: true,
        },
      });

      if (!payment) {
        throw new AppError(
          "Payment not found",
          404,
          "PAYMENT_NOT_FOUND",
        );
      }

      assertPaymentIsDecidable(payment.status);

      const now = new Date();
      const isVerified = decision === "VERIFIED";
      const derivedOrder = deriveOrderStatusAfterPayment(decision);

      // Atomically claim the submitted payment. A concurrent decision will
      // see zero affected rows and fail cleanly.
      const claimedPayment = await tx.payment.updateMany({
        where: {
          id: paymentId,
          status: "SUBMITTED",
        },
        data: {
          status: decision,
          ...(isVerified && {
            verifiedAt: now,
            verifiedById: adminUserId,
          }),
        },
      });

      if (claimedPayment.count !== 1) {
        const current = await tx.payment.findUnique({
          where: {
            id: paymentId,
          },
          select: {
            status: true,
          },
        });

        if (!current) {
          throw new AppError(
            "Payment not found",
            404,
            "PAYMENT_NOT_FOUND",
          );
        }

        assertPaymentIsDecidable(current.status);

        throw new AppError(
          "Payment decision could not be applied",
          409,
          "PAYMENT_STATE_CONFLICT",
        );
      }

      const updatedOrder = await tx.order.updateMany({
        where: {
          id: payment.orderId,
          status: "PAYMENT_REVIEW",
          paymentStatus: "SUBMITTED",
        },
        data: derivedOrder,
      });

      if (updatedOrder.count !== 1) {
        throw new AppError(
          "Order is not awaiting payment verification",
          409,
          "ORDER_PAYMENT_STATE_CONFLICT",
        );
      }

      let groupsUpdated = 0;
      let committed = 0;
      let released = 0;

      if (isVerified) {
        const groups = await tx.vendorOrderGroup.updateMany({
          where: {
            orderId: payment.orderId,
            fulfilmentStatus: "PENDING_PAYMENT",
          },
          data: {
            fulfilmentStatus: "NEW",
          },
        });

        groupsUpdated = groups.count;

        committed = await commitReservedStock({
          tx,
          orderId: payment.orderId,
          now,
        });
      } else {
        released = await releaseReservedStock({
          tx,
          orderId: payment.orderId,
          now,
        });
      }

      await tx.adminAuditLog.create({
        data: {
          adminUserId,
          action: isVerified
            ? "PAYMENT_VERIFIED"
            : "PAYMENT_REJECTED",
          entityType: "Payment",
          entityId: paymentId,
          before: {
            paymentstatus: payment.status,
            orderid: payment.orderId,
            orderstatus: payment.order.status,
            orderpaymentstatus: payment.order.paymentStatus,
          },
          after: {
            paymentstatus: decision,
            orderid: payment.orderId,
            orderstatus: derivedOrder.status,
            orderpaymentstatus: derivedOrder.paymentStatus,
            rejectionreason: rejectionReason ?? null,
            vendorgroupsupdated: groupsUpdated,
            stockcommitted: committed,
            stockreleased: released,
          },
        },
      });

      const [decidedPayment, order, vendorOrderGroups] =
        await Promise.all([
          tx.payment.findUnique({
            where: {
              id: paymentId,
            },
          }),
          tx.order.findUnique({
            where: {
              id: payment.orderId,
            },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              paymentStatus: true,
            },
          }),
          tx.vendorOrderGroup.findMany({
            where: {
              orderId: payment.orderId,
            },
            orderBy: {
              groupNumber: "asc",
            },
            select: {
              id: true,
              fulfilmentStatus: true,
            },
          }),
        ]);

      return {
        payment: decidedPayment,
        order,
        vendorgroups: vendorOrderGroups,
        stock: {
          committed,
          released,
        },
      };
    },
    {
      maxWait: 5000,
      timeout: 15000,
    },
  );
}