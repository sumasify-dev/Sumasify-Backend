import { asyncHandler } from "../../middleware/utils/asyncHandler.js";

import {
  vendorApplicationBodySchema,
} from "./vendor-application.validation.js";

import {
  submitVendorApplication,
  getMyVendorApplication,
} from "./vendor-application.service.js";

export function createVendorApplicationController({
  submitVendorApplication,
  getMyVendorApplication,
}) {
  // Submit a vendor application.
  const createApplication = asyncHandler(async (req, res) => {
    // 1. Validate the request body.
    const {
      businessname,
      contactphone,
      description,
      categoryNotes,
    } = vendorApplicationBodySchema.parse(req.body);

    // 2. Submit the application.
    const result = await submitVendorApplication({
      userId: req.user.id,
      businessName: businessname,
      contactPhone: contactphone,
      description,
      categoryNotes,
    });

    // 3. Return the response.
    res.status(201).json(result);
  });

  // Retrieve the authenticated buyer's latest application.
  const getMyApplication = asyncHandler(async (req, res) => {
    // 1. Retrieve the application.
    const result = await getMyVendorApplication({
      userId: req.user.id,
    });

    // 2. Return the response.
    res.status(200).json(result);
  });

  return {
    createApplication,
    getMyApplication,
  };
}

// Production controller instance.
const vendorApplicationController = createVendorApplicationController({
  submitVendorApplication,
  getMyVendorApplication,
});

export const {
  createApplication,
  getMyApplication,
} = vendorApplicationController;