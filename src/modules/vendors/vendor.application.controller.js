import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import { createVendorApplicationSchema } from "./vendor.application.validation.js";
import {
  submitApplication,
  getMyApplication,
} from "./vendor.application.service.js";

export function createVendorApplicationController({
  submitApplication,
  getMyApplication,
}) {
  const submit = asyncHandler(async (req, res) => {
    const data = createVendorApplicationSchema.parse(req.body);

    const result = await submitApplication({
      userId: req.user.id,
      data,
    });

    res.status(201).json(result);
  });

  const getMine = asyncHandler(async (req, res) => {
    const result = await getMyApplication({
      userId: req.user.id,
    });

    res.status(200).json(result);
  });

  return {
    submit,
    getMine,
  };
}

const vendorApplicationController = createVendorApplicationController({
  submitApplication,
  getMyApplication,
});

export const { submit, getMine } = vendorApplicationController;