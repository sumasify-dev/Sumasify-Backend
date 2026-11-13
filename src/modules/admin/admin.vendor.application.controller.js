import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import {
  adminVendorApplicationListSchema,
  vendorApplicationIdSchema,
  vendorApplicationDecisionSchema,
} from "./admin.vendor.application.validation.js";
import {
  listApplications,
  decideApplication,
} from "./admin.vendor.application.service.js";

export function createAdminVendorApplicationController({
  listApplications,
  decideApplication,
}) {
  const list = asyncHandler(async (req, res) => {
    const { status, page, pageSize } =
      adminVendorApplicationListSchema.parse(req.query);

    const result = await listApplications({
      status,
      page,
      pageSize,
    });

    res.status(200).json(result);
  });

  const decide = asyncHandler(async (req, res) => {
    const { id } = vendorApplicationIdSchema.parse(req.params);
    const { decision, rejectionreason } =
      vendorApplicationDecisionSchema.parse(req.body);

    const result = await decideApplication({
      applicationId: id,
      adminUserId: req.user.id,
      decision: decision.toUpperCase(),
      rejectionReason: rejectionreason ?? null,
    });

    res.status(200).json(result);
  });

  return {
    list,
    decide,
  };
}

const adminVendorApplicationController =
  createAdminVendorApplicationController({
    listApplications,
    decideApplication,
  });

export const { list, decide } = adminVendorApplicationController;