import { z } from "zod";

export const createVendorApplicationSchema = z.object({
  businessname: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(150, "Business name cannot exceed 150 characters"),
  contactphone: z
    .string()
    .trim()
    .min(7, "Contact phone is too short")
    .max(20, "Contact phone is too long"),
  description: z
    .string()
    .trim()
    .max(2000, "Description cannot exceed 2000 characters")
    .optional(),
  categorynotes: z
    .string()
    .trim()
    .max(1000, "Category notes cannot exceed 1000 characters")
    .optional(),
});