import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import {
  checkoutPreviewSchema,
  checkoutCreateSchema,
  checkoutHeadersSchema,
} from "./checkout.validation.js";
import {
  previewCheckout,
  createCheckoutOrder,
} from "./checkout.service.js";

export function createCheckoutController({
  previewCheckout,
  createCheckoutOrder,
}) {
  const preview = asyncHandler(async (req, res) => {
    const { addressid, deliverypreferences } =
      checkoutPreviewSchema.parse(req.body);

    const result = await previewCheckout({
      buyerId: req.user.id,
      addressid,
      deliverypreferences,
    });

    res.status(200).json(result);
  });

  const create = asyncHandler(async (req, res) => {
    const { addressid, deliverypreferences, paymentmethod } =
      checkoutCreateSchema.parse(req.body);

    const { "idempotency-key": idempotencyKey } =
      checkoutHeadersSchema.parse(req.headers);

    const result = await createCheckoutOrder({
      buyerId: req.user.id,
      addressid,
      deliverypreferences,
      paymentmethod,
      idempotencykey: idempotencyKey,
    });

    res.status(201).json(result);
  });

  return {
    preview,
    create,
  };
}

const checkoutController = createCheckoutController({
  previewCheckout,
  createCheckoutOrder,
});

export const { preview, create } = checkoutController;