import { z } from "zod";

const applicationStatuses = ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN"];

export const listVendorApplicationsSchema = z.object({
  status: z.enum(applicationStatuses).optional(),

  page: z.coerce.number().int().min(1).default(1),

  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const vendorApplicationIdSchema = z.object({
  id: z.uuid("A valid vendor application ID is required."),
});

export const reviewVendorApplicationSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("APPROVED"),
  }),

  z.object({
    decision: z.literal("REJECTED"),
    rejectionReason: z
      .string()
      .trim()
      .min(1, "A rejection reason is required.")
      .max(1000, "Rejection reason must not exceed 1000 characters."),
  }),
]);
