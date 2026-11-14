import { z } from "zod";

const deliveryPreferenceSchema = z.object({
  method: z.enum(["DELIVERY", "PICKUP"]),
});

const deliveryPreferencesSchema = z
  .record(z.uuid(), deliveryPreferenceSchema)
  .refine(
    (preferences) => Object.keys(preferences).length > 0,
    "At least one vendor delivery preference is required.",
  );

export const checkoutPreviewSchema = z.object({
  addressId: z.uuid("A valid address ID is required."),
  deliveryPreferences: deliveryPreferencesSchema,
});

export const createCheckoutOrderSchema = checkoutPreviewSchema.extend({
  paymentMethod: z.literal("BANK_TRANSFER"),
});

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, "Idempotency-Key must contain at least 8 characters.")
  .max(128, "Idempotency-Key must not exceed 128 characters.");
