import { z } from "zod";
import { toInternationalFormat } from "../../middleware/utils/phoneNumber.js";

const phoneNumberSchema = z
  .string()
  .regex(
    /^(0|\+?234)[7-9][01]\d{8}$/,
    "Please enter a valid Nigerian phone number"
  )
  .transform(toInternationalFormat);

const emailSchema = z
  .string()
  .trim()
  .email("Please enter a valid email address");

const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters");

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(5, "Full name must be at least 5 characters")
    .optional(),
  fullname: z
    .string()
    .trim()
    .min(5, "Full name must be at least 5 characters")
    .optional(),

  email: emailSchema,

  password: passwordSchema,

  phone: phoneNumberSchema.optional(),

  agreedToTermsAndConditions: z
    .literal(true, {
      errorMap: () => ({
        message: "You must agree to the terms and conditions",
      }),
    })
    .optional(),
  agreedtotermsandconditions: z
    .literal(true, {
      errorMap: () => ({
        message: "You must agree to the terms and conditions",
      }),
    })
    .optional(),

  agreedToPrivacyPolicy: z
    .literal(true, {
      errorMap: () => ({
        message: "You must agree to the privacy policy",
      }),
    })
    .optional(),
  agreedtoprivacypolicy: z
    .literal(true, {
      errorMap: () => ({
        message: "You must agree to the privacy policy",
      }),
    })
    .optional(),
}).transform((data) => {
  const fullName = data.fullName ?? data.fullname;
  const agreedToTermsAndConditions =
    data.agreedToTermsAndConditions ?? data.agreedtotermsandconditions;
  const agreedToPrivacyPolicy =
    data.agreedToPrivacyPolicy ?? data.agreedtoprivacypolicy;

  return {
    ...data,
    fullName,
    agreedToTermsAndConditions,
    agreedToPrivacyPolicy,
  };
}).refine((data) => Boolean(data.fullName), {
  message: "Full name must be at least 5 characters",
  path: ["fullName"],
}).refine((data) => data.agreedToTermsAndConditions === true, {
  message: "You must agree to the terms and conditions",
  path: ["agreedToTermsAndConditions"],
}).refine((data) => data.agreedToPrivacyPolicy === true, {
  message: "You must agree to the privacy policy",
  path: ["agreedToPrivacyPolicy"],
});

export const loginSchema = z.object({
  email: emailSchema,

  password: passwordSchema,
});

export const googleAuthSchema = z.object({
  credential: z
    .string()
    .min(1, "Google credential is required"),

  agreedToTermsAndConditions: z
    .literal(true, {
      errorMap: () => ({
        message: "You must agree to the terms and conditions",
      }),
    })
    .optional(),
  agreedtotermsandconditions: z
    .literal(true, {
      errorMap: () => ({
        message: "You must agree to the terms and conditions",
      }),
    })
    .optional(),

  agreedToPrivacyPolicy: z
    .literal(true, {
      errorMap: () => ({
        message: "You must agree to the privacy policy",
      }),
    })
    .optional(),
  agreedtoprivacypolicy: z
    .literal(true, {
      errorMap: () => ({
        message: "You must agree to the privacy policy",
      }),
    })
    .optional(),
}).transform((data) => ({
  ...data,
  agreedToTermsAndConditions:
    data.agreedToTermsAndConditions ?? data.agreedtotermsandconditions,
  agreedToPrivacyPolicy:
    data.agreedToPrivacyPolicy ?? data.agreedtoprivacypolicy,
})).refine((data) => data.agreedToTermsAndConditions === true, {
  message: "You must agree to the terms and conditions",
  path: ["agreedToTermsAndConditions"],
}).refine((data) => data.agreedToPrivacyPolicy === true, {
  message: "You must agree to the privacy policy",
  path: ["agreedToPrivacyPolicy"],
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(1, "Reset token is required"),

  newPassword: passwordSchema.optional(),
  newpassword: passwordSchema.optional(),
}).transform((data) => ({
  ...data,
  newPassword: data.newPassword ?? data.newpassword,
})).refine((data) => Boolean(data.newPassword), {
  message: "Password must be at least 6 characters",
  path: ["newPassword"],
});




