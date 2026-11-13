import { z } from "zod";

const applicationStatus = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  z.enum(["pending", "approved", "rejected", "withdrawn"]),
);

export const adminVendorApplicationListSchema = z
  .object({
    status: applicationStatus.optional(),
    page: z.coerce
      .number()
      .int("Page must be a whole number")
      .min(1, "Page must be at least 1")
      .default(1),
    pageSize: z.coerce
      .number()
      .int("Page size must be a whole number")
      .min(1, "Page size must be at least 1")
      .max(50, "Page size cannot exceed 50")
      .optional(),
    pagesize: z.coerce
      .number()
      .int("Page size must be a whole number")
      .min(1, "Page size must be at least 1")
      .max(50, "Page size cannot exceed 50")
      .optional(),
  })
  .transform((data) => ({
    status: data.status?.toUpperCase(),
    page: data.page,
    pageSize: data.pageSize ?? data.pagesize ?? 20,
  }));

export const vendorApplicationIdSchema = z.object({
  id: z.string().uuid("Invalid vendor application id"),
});

const decisionSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  z.enum(["approved", "rejected"], {
    message: "Decision must be approved or rejected",
  }),
);

export const vendorApplicationDecisionSchema = z
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
      data.decision === "rejected" &&
      data.rejectionreason === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["rejectionreason"],
        message:
          "Rejection reason is required when rejecting an application",
      });
    }
  });