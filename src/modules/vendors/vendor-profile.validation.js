import { z } from "zod";

export const updateVendorProfileBodySchema = z
  .object({
    businessname: z.string().trim().min(1, "Business name cannot be empty").optional(),
    contactphone: z.string().trim().min(1, "Contact phone cannot be empty").optional(),
    pickupaddress: z.string().trim().min(1, "Pickup address cannot be empty").optional(),
    deliverynotes: z.string().trim().min(1, "Delivery notes cannot be empty").optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });