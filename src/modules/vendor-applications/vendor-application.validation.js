import { z } from "zod";

export const vendorApplicationBodySchema = z.object({
  businessname: z
    .string()
    .trim()
    .min(1, "Business name is required"),

  contactphone: z
    .string()
    .trim()
    .min(1, "Contact phone is required"),

  description: z
    .string()
    .trim()
    .min(1, "Business description is required"),

  categoryNotes: z
    .string()
    .trim()
    .optional(),
});