import { toInternationalFormat } from "../../middleware/utils/phoneNumber.js";
import { AppError } from "../../middleware/utils/AppError.js";
import {
  findPendingApplicationByUserId,
  findLatestApplicationByUserId,
  createVendorApplication,
} from "./vendor.application.model.js";

export function toVendorApplicationDto(application) {
  return {
    id: application.id,
    businessname: application.businessName,
    contactphone: application.contactPhone,
    description: application.description,
    categorynotes: application.categoryNotes,
    status: application.status.toLowerCase(),
    rejectionreason: application.rejectionReason ?? null,
    reviewedat: application.reviewedAt,
    createdat: application.createdAt,
    updatedat: application.updatedAt,
  };
}

export function createVendorApplicationService({
  findPendingApplicationByUserId,
  findLatestApplicationByUserId,
  createVendorApplication,
}) {
  async function submitApplication({ userId, data }) {
    const pendingApplication =
      await findPendingApplicationByUserId(userId);

    if (pendingApplication) {
      throw new AppError(
        "A vendor application is already pending review",
        409,
        "VENDOR_APPLICATION_PENDING",
      );
    }

    const application = await createVendorApplication({
      userId,
      data: {
        ...data,
        contactphone: toInternationalFormat(data.contactphone),
      },
    });

    if (!application) {
      throw new AppError(
        "A vendor application is already pending review",
        409,
        "VENDOR_APPLICATION_PENDING",
      );
    }

    return {
      data: toVendorApplicationDto(application),
    };
  }

  async function getMyApplication({ userId }) {
    const application = await findLatestApplicationByUserId(userId);

    return {
      data: application ? toVendorApplicationDto(application) : null,
    };
  }

  return {
    submitApplication,
    getMyApplication,
  };
}

const vendorApplicationService = createVendorApplicationService({
  findPendingApplicationByUserId,
  findLatestApplicationByUserId,
  createVendorApplication,
});

export const { submitApplication, getMyApplication } =
  vendorApplicationService;