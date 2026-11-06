import {
  findOrderForPayment,
  findPaymentByIdempotencyKey,
  findPaymentByBankReference,
  createPaymentSubmission,
} from "./payment.model.js";

import { AppError } from "../../middleware/utils/AppError.js";

function formatMoney(amount) {
  return amount.toFixed(2);
}

function formatSubmission({ payment, order }) {
  return {
    data: {
      payment: {
        id: payment.id,
        status: payment.status,
        amount: formatMoney(payment.amount),
        bankreference: payment.bankReference,
        submittedat: payment.submittedAt,
      },
      order: {
        id: order.id,
        ordernumber: order.orderNumber,
        status: order.status,
        paymentstatus: order.paymentStatus,
      },
    },
  };
}

export function createPaymentService({
  findOrderForPayment,
  findPaymentByIdempotencyKey,
  findPaymentByBankReference,
  createPaymentSubmission,
}) {
  async function submitBankTransfer({
    orderId,
    buyerId,
    bankReference,
    idempotencyKey,
  }) {
    // 1. Check whether this request was already processed.
    const existingPayment = await findPaymentByIdempotencyKey({
      idempotencyKey,
    });

    if (existingPayment) {
      // Retrieve the order associated with the existing payment.
      const existingOrder = await findOrderForPayment({
        orderId: existingPayment.orderId,
      });

      if (!existingOrder || existingOrder.buyerId !== buyerId) {
        throw new AppError(
          "You are not authorized to access this payment",
          403,
          "PAYMENT_FORBIDDEN"
        );
      }

      // Ensure the key is being reused for the same request.
      if (
        existingPayment.orderId !== orderId ||
        existingPayment.bankReference !== bankReference
      ) {
        throw new AppError(
          "Idempotency key has already been used for another request",
          409,
          "IDEMPOTENCY_KEY_CONFLICT"
        );
      }

      const currentOrder = {
        id: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        status: existingOrder.status,
        paymentStatus: existingOrder.paymentStatus,
      };

      return formatSubmission({
        payment: existingPayment,
        order: currentOrder,
      });
    }

    // 2. Retrieve the order.
    const order = await findOrderForPayment({ orderId });

    if (!order) {
      throw new AppError(
        "Order not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    // 3. Verify order ownership.
    if (order.buyerId !== buyerId) {
      throw new AppError(
        "You are not authorized to submit payment for this order",
        403,
        "ORDER_FORBIDDEN"
      );
    }

    // 4. Validate the order's current payment state.
    if (
      order.status !== "AWAITING_PAYMENT" ||
      order.paymentStatus !== "AWAITING_SUBMISSION"
    ) {
      throw new AppError(
        "Payment cannot be submitted for this order",
        409,
        "INVALID_PAYMENT_STATE"
      );
    }

    // 5. Check whether the bank reference has already been used.
    const existingBankReference =
      await findPaymentByBankReference({ bankReference });

    if (existingBankReference) {
      throw new AppError(
        "This bank reference has already been submitted",
        409,
        "DUPLICATE_BANK_REFERENCE"
      );
    }

    // 6. Create payment and update order.
    let result;

try {
  result = await createPaymentSubmission({
    orderId,
    amount: order.totalAmount,
    bankReference,
    idempotencyKey,
  });
} catch (error) {
  if (error.code === "P2002") {
    // Check whether another request already processed this idempotency key.
    const existingPayment = await findPaymentByIdempotencyKey({
      idempotencyKey,
    });

    if (existingPayment) {
      const existingOrder = await findOrderForPayment({
        orderId: existingPayment.orderId,
      });

      if (!existingOrder || existingOrder.buyerId !== buyerId) {
        throw new AppError(
          "You are not authorized to access this payment",
          403,
          "PAYMENT_FORBIDDEN"
        );
      }

      if (
        existingPayment.orderId !== orderId ||
        existingPayment.bankReference !== bankReference
      ) {
        throw new AppError(
          "Idempotency key has already been used for another request",
          409,
          "IDEMPOTENCY_KEY_CONFLICT"
        );
      }

      return formatSubmission({
        payment: existingPayment,
        order: {
          id: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          status: existingOrder.status,
          paymentStatus: existingOrder.paymentStatus,
        },
      });
    }

    throw new AppError(
      "This bank reference has already been submitted",
      409,
      "DUPLICATE_BANK_REFERENCE"
    );
  }

  throw error;
}
    if (!result) {
  // Check whether another request processed this idempotency key.
  const existingPayment = await findPaymentByIdempotencyKey({
    idempotencyKey,
  });

  if (existingPayment) {
    const existingOrder = await findOrderForPayment({
      orderId: existingPayment.orderId,
    });

    if (!existingOrder || existingOrder.buyerId !== buyerId) {
      throw new AppError(
        "You are not authorized to access this payment",
        403,
        "PAYMENT_FORBIDDEN"
      );
    }

    if (
      existingPayment.orderId !== orderId ||
      existingPayment.bankReference !== bankReference
    ) {
      throw new AppError(
        "Idempotency key has already been used for another request",
        409,
        "IDEMPOTENCY_KEY_CONFLICT"
      );
    }

    return formatSubmission({
      payment: existingPayment,
      order: {
        id: existingOrder.id,
        orderNumber: existingOrder.orderNumber,
        status: existingOrder.status,
        paymentStatus: existingOrder.paymentStatus,
      },
    });
  }

  throw new AppError(
    "Payment cannot be submitted for this order",
    409,
    "INVALID_PAYMENT_STATE"
  );
}

    return formatSubmission(result);
  }

  return {
    submitBankTransfer,
  };
}

// Production instance.
const paymentService = createPaymentService({
  findOrderForPayment,
  findPaymentByIdempotencyKey,
  findPaymentByBankReference,
  createPaymentSubmission,
});

export const { submitBankTransfer } = paymentService;