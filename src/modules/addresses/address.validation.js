import { z } from "zod";

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .optional();

export const createAddressSchema = z.object({
  label: optionalText(50),
  recipientname: z
    .string()
    .trim()
    .min(2, "Recipient name must be at least 2 characters")
    .max(150, "Recipient name cannot exceed 150 characters"),
  phone: z
    .string()
    .trim()
    .min(7, "Phone number is too short")
    .max(20, "Phone number is too long"),
  areacode: optionalText(20),
  addressline: z
    .string()
    .trim()
    .min(5, "Address line must be at least 5 characters")
    .max(500, "Address line cannot exceed 500 characters"),
  instructions: optionalText(500),
  isdefault: z.boolean().optional().default(false),
});