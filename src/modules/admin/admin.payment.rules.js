import { AppError } from "../../middleware/utils/AppError.js";

export const PAYMENT_DECISIONS = Object.freeze({
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
});

/**
 * A payment may only be decided once, and only after the buyer has
 * submitted a bank-transfer reference.
 */
export function assertPaymentIsDecidable(paymentStatus) {
  if (paymentStatus === "VERIFIED") {
    throw new AppError(
      "This payment has already been verified",
      409,
      "PAYMENT_ALREADY_VERIFIED",
    );
  }

  if (paymentStatus === "REJECTED") {
    throw new AppError(
      "This payment has already been rejected",
      409,
      "PAYMENT_ALREADY_REJECTED",
    );
  }

  if (paymentStatus !== "SUBMITTED") {
    throw new AppError(
      "Only submitted payments can be verified or rejected",
      409,
      "PAYMENT_NOT_SUBMITTED",
    );
  }
}