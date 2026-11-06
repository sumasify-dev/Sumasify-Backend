import prisma from "../../config/prisma.js";

// Find an order and its existing payment records.
export async function findOrderForPayment({ orderId }) {
  return prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
}

// Find an existing payment using its idempotency key.
export async function findPaymentByIdempotencyKey({ idempotencyKey }) {
  return prisma.payment.findUnique({
    where: {
      idempotencyKey,
    },
  });
}

// Check whether a bank reference has already been submitted.
export async function findPaymentByBankReference({ bankReference }) {
  return prisma.payment.findFirst({
    where: {
      bankReference,
    },
  });
}

// Create the payment and update the order atomically.
export async function createPaymentSubmission({
  orderId,
  amount,
  bankReference,
  idempotencyKey,
}) {
  return prisma.$transaction(async (tx) => {
    // 1. Atomically claim the order for payment submission.
    const updatedOrder = await tx.order.updateMany({
      where: {
        id: orderId,
        status: "AWAITING_PAYMENT",
        paymentStatus: "AWAITING_SUBMISSION",
      },
      data: {
        status: "PAYMENT_REVIEW",
        paymentStatus: "SUBMITTED",
      },
    });

    // Another request may have already submitted payment.
    if (updatedOrder.count === 0) {
      return null;
    }

    // 2. Create the payment record.
    const payment = await tx.payment.create({
      data: {
        orderId,
        amount,
        bankReference,
        idempotencyKey,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    // 3. Retrieve the updated order details.
    const order = await tx.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
      },
    });

    return {
      payment,
      order,
    };
  });
}