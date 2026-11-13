import { z } from "zod";

const deliveryPreferenceSchema = z.object({
  method: z.enum(["DELIVERY", "PICKUP"]),
});

const checkoutPayloadSchema = z.object({
  addressid: z.string().uuid("Invalid address id"),
  deliverypreferences: z.record(
    z.string().uuid("Invalid vendor id"),
    deliveryPreferenceSchema,
  ),
});

export const checkoutPreviewSchema = checkoutPayloadSchema;

export const checkoutCreateSchema = checkoutPayloadSchema.extend({
  paymentmethod: z.enum(["BANK_TRANSFER"], {
    message: "Only BANK_TRANSFER is supported",
  }),
});

export const checkoutHeadersSchema = z.object({
  "idempotency-key": z
    .string()
    .trim()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key cannot exceed 255 characters"),
});