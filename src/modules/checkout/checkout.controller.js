import { AppError } from "../../middleware/utils/AppError.js";
import { asyncHandler } from "../../middleware/utils/asyncHandler.js";

import {
  checkoutPreviewSchema,
  createCheckoutOrderSchema,
  idempotencyKeySchema,
} from "./checkout.validation.js";

import { previewCheckout, createCheckoutOrder } from "./checkout.service.js";

function requireBuyer(req) {
  if (!req.user?.id || req.user.role !== "buyer") {
    throw new AppError(
      "Only authenticated buyers can use checkout.",
      403,
      "FORBIDDEN",
    );
  }
}

export const preview = asyncHandler(async (req, res) => {
  requireBuyer(req);

  const input = checkoutPreviewSchema.parse(req.body);
  const data = await previewCheckout(req.user.id, input);

  res.status(200).json({ data });
});

export const createOrder = asyncHandler(async (req, res) => {
  requireBuyer(req);

  const input = createCheckoutOrderSchema.parse(req.body);
  const key = idempotencyKeySchema.parse(req.get("Idempotency-Key"));

  const result = await createCheckoutOrder(req.user.id, input, key);

  const order = result.order;
  const payment = result.payment;

  const data = {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      subtotalAmount: String(order.subtotalAmount),
      deliveryAmount: String(order.deliveryAmount),
      totalAmount: String(order.totalAmount),
      vendorGroups: order.vendorOrderGroups.map((group) => ({
        id: group.id,
        vendor: group.vendor,
        fulfilmentStatus: group.fulfilmentStatus,
        deliveryMethod: group.deliveryMethod,
        subtotalAmount: String(group.subtotalAmount),
        deliveryAmount: String(group.deliveryAmount),
        commissionAmount: String(group.commissionAmount),
        payoutAmount: String(group.payoutAmount),
        items: group.orderItems.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.productNameSnapshot,
          quantity: item.quantity,
          unitPriceAmount: String(item.unitPriceAmount),
          lineTotalAmount: String(item.lineTotalAmount),
          imageUrl: item.imageUrlSnapshot,
        })),
      })),
    },
    payment: {
      id: payment.id,
      method: payment.method,
      status: payment.status,
      amount: String(payment.amount),
    },
    paymentInstructions: result.paymentInstructions,
  };

  res.status(result.reused ? 200 : 201).json({ data });
});
