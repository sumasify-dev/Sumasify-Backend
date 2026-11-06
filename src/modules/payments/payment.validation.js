import { z } from "zod";

export const paymentSubmissionParamsSchema = z.object({
  orderid: z.string().uuid("Invalid order ID"),
});

export const paymentSubmissionBodySchema = z.object({
  bankreference: z
    .string()
    .trim()
    .min(1, "Bank reference is required")
    .max(100, "Bank reference cannot exceed 100 characters"),
});

export const paymentSubmissionHeadersSchema = z.object({
  "idempotency-key": z
    .string()
    .trim()
    .min(1, "Idempotency key is required")
    .max(255, "Idempotency key cannot exceed 255 characters"),
});