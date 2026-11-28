import { AppError } from "../../middleware/utils/AppError.js";
import { asyncHandler } from "../../middleware/utils/asyncHandler.js";

import {
  listVendorApplicationsSchema,
  vendorApplicationIdSchema,
  reviewVendorApplicationSchema,
} from "./admin.vendor-applications.validation.js";

import {
  listVendorApplications,
  reviewVendorApplication,
} from "./admin.vendor-applications.service.js";

function requireAdmin(req) {
  if (!req.user || req.user.role !== "admin") {
    throw new AppError(
      "You do not have permission to perform this action.",
      403,
      "FORBIDDEN",
    );
  }
}

export const getVendorApplications = asyncHandler(async (req, res) => {
  requireAdmin(req);

  const query = listVendorApplicationsSchema.parse(req.query);

  const result = await listVendorApplications(query);

  return res.status(200).json({
    data: result.data,
    meta: result.meta,
  });
});

export const reviewApplication = asyncHandler(async (req, res) => {
  requireAdmin(req);

  const { id } = vendorApplicationIdSchema.parse(req.params);

  const body = reviewVendorApplicationSchema.parse(req.body);

  const result = await reviewVendorApplication({
    applicationId: id,
    adminUserId: req.user.id,
    decision: body.decision,
    rejectionReason: body.rejectionReason,
  });

  return res.status(200).json({
    data: result,
  });
});
