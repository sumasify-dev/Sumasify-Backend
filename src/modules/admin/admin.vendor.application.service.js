import { AppError } from "../../middleware/utils/AppError.js";
import {
  findVendorApplicationsWithUsers,
  countVendorApplications,
  applyVendorApplicationDecision,
} from "./admin.vendor.application.model.js";

export function toAdminVendorApplicationDto(application) {
  return {
    id: application.id,
    businessname: application.businessName,
    contactphone: application.contactPhone,
    description: application.description,
    categorynotes: application.categoryNotes,
    status: application.status.toLowerCase(),
    rejectionreason: application.rejectionReason ?? null,
    reviewedbyid: application.reviewedById,
    reviewedat: application.reviewedAt,
    createdat: application.createdAt,
    updatedat: application.updatedAt,
    user: application.user
      ? {
          id: application.user.id,
          fullname: application.user.fullName,
          email: application.user.email,
        }
      : null,
    vendor: application.user?.vendor
      ? {
          id: application.user.vendor.id,
          status: application.user.vendor.status.toLowerCase(),
        }
      : null,
  };
}

export function createAdminVendorApplicationService({
  findVendorApplicationsWithUsers,
  countVendorApplications,
  applyVendorApplicationDecision,
}) {
  async function listApplications({ status, page, pageSize }) {
    const skip = (page - 1) * pageSize;

    const [applications, total] = await Promise.all([
      findVendorApplicationsWithUsers({
        status,
        skip,
        take: pageSize,
      }),
      countVendorApplications({ status }),
    ]);

    return {
      data: applications.map(toAdminVendorApplicationDto),
      meta: {
        page,
        pagesize: pageSize,
        total,
        totalpages: Math.ceil(total / pageSize),
      },
    };
  }

  async function decideApplication({
    applicationId,
    adminUserId,
    decision,
    rejectionReason,
  }) {
    if (!["APPROVED", "REJECTED"].includes(decision)) {
      throw new AppError(
        "Decision must be approved or rejected",
        400,
        "INVALID_APPLICATION_DECISION",
      );
    }

    const normalizedRejectionReason =
      typeof rejectionReason === "string" && rejectionReason.trim() !== ""
        ? rejectionReason.trim()
        : null;

    if (
      decision === "REJECTED" &&
      normalizedRejectionReason === null
    ) {
      throw new AppError(
        "Rejection reason is required when rejecting an application",
        400,
        "REJECTION_REASON_REQUIRED",
      );
    }

    const result = await applyVendorApplicationDecision({
      applicationId,
      adminUserId,
      decision,
      rejectionReason: normalizedRejectionReason,
    });

    return {
      data: toAdminVendorApplicationDto(result.application),
    };
  }

  return {
    listApplications,
    decideApplication,
  };
}

const adminVendorApplicationService =
  createAdminVendorApplicationService({
    findVendorApplicationsWithUsers,
    countVendorApplications,
    applyVendorApplicationDecision,
  });

export const { listApplications, decideApplication } =
  adminVendorApplicationService;