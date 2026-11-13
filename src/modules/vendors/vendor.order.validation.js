import { z } from "zod";

const statuses = [
  "pending_payment",
  "new",
  "confirmed",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
];

const targetStatuses = [
  "new",
  "confirmed",
  "ready",
  "out_for_delivery",
  "delivered",
  "completed",
];

const normalizedStatus = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  z.enum(statuses),
);

export const vendorOrderListSchema = z
  .object({
    status: normalizedStatus.optional(),
    page: z.coerce
      .number()
      .int("Page must be a whole number")
      .min(1, "Page must be at least 1")
      .default(1),
    pageSize: z.coerce
      .number()
      .int("Page size must be a whole number")
      .min(1)
      .max(50, "Page size cannot exceed 50")
      .optional(),
    pagesize: z.coerce
      .number()
      .int("Page size must be a whole number")
      .min(1)
      .max(50, "Page size cannot exceed 50")
      .optional(),
  })
  .transform((data) => ({
    status: data.status?.toUpperCase(),
    page: data.page,
    pageSize: data.pageSize ?? data.pagesize ?? 20,
  }));

export const vendorOrderGroupIdSchema = z.object({
  groupid: z.string().uuid("Invalid vendor order group id"),
});

export const updateVendorOrderStatusSchema = z.object({
  status: z.preprocess(
    (value) =>
      typeof value === "string"
        ? value.trim().toLowerCase()
        : value,
    z.enum(targetStatuses, {
      message: "Invalid fulfilment status",
    }),
  ),
  vendornotes: z
    .string()
    .trim()
    .max(2000, "Vendor notes cannot exceed 2000 characters")
    .optional(),
});