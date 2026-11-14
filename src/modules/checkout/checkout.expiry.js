import prisma from "../../config/prisma.js";

const EXPIRY_INTERVAL_MS = 30_000;

export async function expirePendingPayments(now = new Date()) {
  const expiredReservations = await prisma.stockReservation.findMany({
    where: {
      expiresAt: { lte: now },
      releasedAt: null,
      committedAt: null,
    },
    select: {
      orderId: true,
    },
    distinct: ["orderId"],
  });

  let expiredCount = 0;

  for (const { orderId } of expiredReservations) {
    try {
      const didExpire = await prisma.$transaction(
        async (tx) => {
          // This conditional update is the race guard.
          // If payment submission or verification already changed the state,
          // this transaction must not release the stock.
          const paymentUpdate = await tx.payment.updateMany({
            where: {
              orderId,
              status: "AWAITING_SUBMISSION",
            },
            data: {
              status: "EXPIRED",
            },
          });

          if (paymentUpdate.count !== 1) {
            return false;
          }

          const orderUpdate = await tx.order.updateMany({
            where: {
              id: orderId,
              status: "AWAITING_PAYMENT",
              paymentStatus: "AWAITING_SUBMISSION",
            },
            data: {
              status: "EXPIRED",
              paymentStatus: "EXPIRED",
            },
          });

          if (orderUpdate.count !== 1) {
            throw new Error(
              `Order ${orderId} could not transition to EXPIRED.`,
            );
          }

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

          for (const reservation of reservations) {
            const changed = await tx.$executeRaw`
              UPDATE products
              SET
                stock_reserved = stock_reserved - ${reservation.quantity},
                updated_at = NOW()
              WHERE
                id = ${reservation.productId}
                AND stock_reserved >= ${reservation.quantity}
            `;

            if (changed !== 1) {
              throw new Error(
                `Could not release stock for reservation ${reservation.id}.`,
              );
            }

            await tx.stockReservation.update({
              where: { id: reservation.id },
              data: { releasedAt: now },
            });
          }

          return true;
        },
        {
          isolationLevel: "Serializable",
          maxWait: 10000,
          timeout: 20000,
        },
      );

      if (didExpire) expiredCount += 1;
    } catch (error) {
      // A single failed order must not stop expiry processing for others.
      console.error(`Payment expiry failed for order ${orderId}:`, error);
    }
  }

  return expiredCount;
}

export function startPaymentExpiryWorker() {
  let running = false;

  const run = async () => {
    if (running) return;

    running = true;

    try {
      const count = await expirePendingPayments();

      if (count > 0) {
        console.log(`Expired ${count} pending checkout order(s).`);
      }
    } catch (error) {
      console.error("Payment expiry worker failed:", error);
    } finally {
      running = false;
    }
  };

  // Run once at startup, then periodically.
  void run();

  const timer = setInterval(run, EXPIRY_INTERVAL_MS);
  timer.unref?.();

  return timer;
}
