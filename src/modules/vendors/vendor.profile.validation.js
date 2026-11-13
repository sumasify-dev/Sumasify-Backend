import { z } from "zod";

const businessName = z
  .string()
  .trim()
  .min(2, "Business name must be at least 2 characters")
  .max(150, "Business name cannot exceed 150 characters");

const contactPhone = z
  .string()
  .trim()
  .min(7, "Contact phone is too short")
  .max(20, "Contact phone is too long");

export const updateVendorProfileSchema = z
  .object({
    businessname: businessName.optional(),
    contactphone: contactPhone.optional(),
    pickupaddress: z
      .string()
      .trim()
      .max(500, "Pickup address cannot exceed 500 characters")
      .optional(),
    deliverynotes: z
      .string()
      .trim()
      .max(1000, "Delivery notes cannot exceed 1000 characters")
      .optional(),
  })
  .refine(
    (data) =>
      data.businessname !== undefined ||
      data.contactphone !== undefined ||
      data.pickupaddress !== undefined ||
      data.deliverynotes !== undefined,
    {
      message: "At least one vendor profile field must be provided",
    },
  );