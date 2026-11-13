import { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../middleware/utils/AppError.js";
import {
  findPaymentForDecision,
  applyPaymentDecision,
} from "./admin.payment.model.js";
import {
  assertPaymentIsDecidable,
  PAYMENT_DECISIONS,
} from "./admin.payment.rules.js";

const VALID_DECISIONS = new Set(Object.values(PAYMENT_DECISIONS));

function formatMoney(value) {
  return new Prisma.Decimal(String(value)).toFixed(2);
}

function formatDecisionResult({
  payment,
  order,
  vendorgroups,
  stock,
}) {
  return {
    data: {
      payment: {
        id: payment.id,
        method: payment.method,
        status: payment.status,
        amount: formatMoney(payment.amount),
        bankreference: payment.bankReference,
        submittedat: payment.submittedAt,
        verifiedat: payment.verifiedAt,
        verifiedbyid: payment.verifiedById,
      },
      order: {
        id: order.id,
        ordernumber: order.orderNumber,
        status: order.status,
        paymentstatus: order.paymentStatus,
      },
      vendorgroups: vendorgroups.map((group) => ({
        id: group.id,
        fulfilmentstatus: group.fulfilmentStatus,
      })),
      stock: {
        committed: stock.committed,
        released: stock.released,
      },
    },
  };
}

export function createAdminPaymentService({
  findPaymentForDecision,
  applyPaymentDecision,
}) {
  async function decidePayment({
    paymentId,
    adminUserId,
    decision,
    rejectionReason,
  }) {
    if (!VALID_DECISIONS.has(decision)) {
      throw new AppError(
        "Decision must be VERIFIED or REJECTED",
        400,
        "INVALID_PAYMENT_DECISION",
      );
    }

    const normalizedRejectionReason =
      typeof rejectionReason === "string" && rejectionReason.trim() !== ""
        ? rejectionReason.trim()
        : null;

    if (
      decision === PAYMENT_DECISIONS.REJECTED &&
      normalizedRejectionReason === null
    ) {
      throw new AppError(
        "Rejection reason is required when rejecting a payment",
        400,
        "REJECTION_REASON_REQUIRED",
      );
    }

    const payment = await findPaymentForDecision({ paymentId });

    if (!payment) {
      throw new AppError(
        "Payment not found",
        404,
        "PAYMENT_NOT_FOUND",
      );
    }

    assertPaymentIsDecidable(payment.status);

    const result = await applyPaymentDecision({
      paymentId,
      adminUserId,
      decision,
      rejectionReason: normalizedRejectionReason,
    });

    return formatDecisionResult(result);
  }

  return {
    decidePayment,
  };
}

const adminPaymentService = createAdminPaymentService({
  findPaymentForDecision,
  applyPaymentDecision,
});

export const { decidePayment } = adminPaymentService;