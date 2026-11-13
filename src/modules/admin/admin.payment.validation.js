import { z } from "zod";

export const paymentDecisionParamsSchema = z
  .object({
    paymentId: z.string().uuid("Invalid payment id").optional(),
    paymentid: z.string().uuid("Invalid payment id").optional(),
  })
  .transform((data) => ({
    paymentId: data.paymentId ?? data.paymentid,
  }))
  .refine((data) => Boolean(data.paymentId), {
    message: "Invalid payment id",
  });

const decisionSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  z.enum(["VERIFIED", "REJECTED"], {
    message: "Decision must be VERIFIED or REJECTED",
  }),
);

export const paymentDecisionBodySchema = z
  .object({
    decision: decisionSchema,
    rejectionreason: z
      .string()
      .trim()
      .min(1, "Rejection reason is required")
      .max(500, "Rejection reason cannot exceed 500 characters")
      .optional(),
  })
  .superRefine((data, context) => {
    if (
      data.decision === "REJECTED" &&
      data.rejectionreason === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["rejectionreason"],
        message: "Rejection reason is required when rejecting a payment",
      });
    }
  });