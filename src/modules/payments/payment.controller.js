import { asyncHandler } from "../../middleware/utils/asyncHandler.js";

import {
  paymentSubmissionParamsSchema,
  paymentSubmissionBodySchema,
  paymentSubmissionHeadersSchema,
} from "./payment.validation.js";

import { submitBankTransfer } from "./payment.service.js";

export function createPaymentController({ submitBankTransfer }) {
  const submitBankTransferPayment = asyncHandler(async (req, res) => {
    // 1. Validate the order ID.
    const { orderid } = paymentSubmissionParamsSchema.parse(req.params);

    // 2. Validate the request body.
    const { bankreference } = paymentSubmissionBodySchema.parse(req.body);

    // 3. Validate the idempotency key.
    const { "idempotency-key": idempotencyKey } =
      paymentSubmissionHeadersSchema.parse(req.headers);

    // 4. Submit the payment.
    const result = await submitBankTransfer({
      orderId: orderid,
      buyerId: req.user.id,
      bankReference: bankreference,
      idempotencyKey,
    });

    // 5. Return the response.
    res.status(200).json(result);
  });

  return {
    submitBankTransferPayment,
  };
}

// Production controller instance.
const paymentController = createPaymentController({
  submitBankTransfer,
});

export const { submitBankTransferPayment } = paymentController;