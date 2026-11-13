import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import {
  paymentDecisionParamsSchema,
  paymentDecisionBodySchema,
} from "./admin.payment.validation.js";
import { decidePayment } from "./admin.payment.service.js";

export function createAdminPaymentController({ decidePayment }) {
  const decide = asyncHandler(async (req, res) => {
    const { paymentId } = paymentDecisionParamsSchema.parse(
      req.params,
    );
    const { decision, rejectionreason } =
      paymentDecisionBodySchema.parse(req.body);

    const result = await decidePayment({
      paymentId,
      adminUserId: req.user.id,
      decision,
      rejectionReason: rejectionreason ?? null,
    });

    res.status(200).json(result);
  });

  return {
    decide,
  };
}

const adminPaymentController = createAdminPaymentController({
  decidePayment,
});

export const { decide } = adminPaymentController;