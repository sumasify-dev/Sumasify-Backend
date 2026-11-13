import { z } from "zod";

const orderStatuses = [
"awaiting_payment",
"payment_review",
"paid",
"in_fulfilment",
"completed",
"payment_rejected",
"cancelled",
"expired",
];

export const orderListQuerySchema = z
  .object({
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

    status: z.enum(orderStatuses).optional(),
  })
  .transform((data) => ({
    page: data.page,
    pagesize: data.pageSize ?? data.pagesize ?? 20,
    status: data.status,
  }));

export const orderIdSchema = z
  .object({
    orderId: z.string().uuid("Invalid order ID").optional(),
    orderid: z.string().uuid("Invalid order ID").optional(),
  })
  .transform((data) => ({
    orderid: data.orderId ?? data.orderid,
  }))
  .refine((data) => Boolean(data.orderid), {
    message: "Invalid order ID",
  });