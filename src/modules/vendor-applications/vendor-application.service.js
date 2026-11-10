import {findPendingVendorApplication,createVendorApplication,findLatestVendorApplication} from "./vendor-application.model.js";
import { AppError } from "../../middleware/utils/AppError.js";

function formatApplication(application) {
  return {
    id: application.id,
    status: application.status.toLowerCase(),
    businessname: application.businessName,
    contactphone: application.contactPhone,
    description: application.description,
    categoryNotes: application.categoryNotes,
    createdat: application.createdAt,
  };
}

export function createVendorApplicationService({
  findPendingVendorApplication,
  createVendorApplication,
  findLatestVendorApplication,
}) {
  async function submitVendorApplication({
    userId,
    businessName,
    contactPhone,
    description,
    categoryNotes,
  }) {
    // 1. Check for an existing pending application.
    const existingApplication = await findPendingVendorApplication({
      userId,
    });

    if (existingApplication) {
      throw new AppError(
        "You already have a pending vendor application",
        409,
        "PENDING_APPLICATION_EXISTS"
      );
    }

    // 2. Create the vendor application.
    const application = await createVendorApplication({
      userId,
      businessName,
      contactPhone,
      description,
      categoryNotes,
    });

    // 3. Format the response.
    return {
      data: formatApplication(application),
    };
  }

  async function getMyVendorApplication({ userId }) {
    // 1. Retrieve the buyer's latest application.
    const application = await findLatestVendorApplication({
      userId,
    });

    if (!application) {
      throw new AppError(
        "Vendor application not found",
        404,
        "VENDOR_APPLICATION_NOT_FOUND"
      );
    }

    // 2. Format the response.
    return {
      data: {
        id: application.id,
        status: application.status.toLowerCase(),
        businessname: application.businessName,
        contactphone: application.contactPhone,
        description: application.description,
        rejectionreason: application.rejectionReason,
      },
    };
  }

  return {
    submitVendorApplication,
    getMyVendorApplication,
  };
}

// Production service instance.
const vendorApplicationService = createVendorApplicationService({
  findPendingVendorApplication,
  createVendorApplication,
  findLatestVendorApplication,
});

export const {
  submitVendorApplication,
  getMyVendorApplication,
} = vendorApplicationService;