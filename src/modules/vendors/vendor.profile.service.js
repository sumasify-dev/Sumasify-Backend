import { toInternationalFormat } from "../../middleware/utils/phoneNumber.js";
import { AppError } from "../../middleware/utils/AppError.js";
import {
  findVendorByUserId,
  updateVendorById,
} from "./vendor.profile.model.js";

export function toVendorProfileDto(vendor) {
  return {
    id: vendor.id,
    businessname: vendor.businessName,
    slug: vendor.slug,
    contactphone: vendor.contactPhone,
    pickupaddress: vendor.pickupAddress,
    deliverynotes: vendor.deliveryNotes,
    status: vendor.status.toLowerCase(),
    approvedat: vendor.approvedAt,
    createdat: vendor.createdAt,
    updatedat: vendor.updatedAt,
  };
}

function assertActiveVendor(vendor) {
  if (!vendor) {
    throw new AppError(
      "You do not have an approved vendor profile",
      403,
      "VENDOR_NOT_APPROVED",
    );
  }

  if (vendor.status !== "ACTIVE") {
    throw new AppError(
      "Your vendor account is not active",
      403,
      "VENDOR_INACTIVE",
    );
  }
}

export function createVendorProfileService({
  findVendorByUserId,
  updateVendorById,
}) {
  async function getProfile({ userId }) {
    const vendor = await findVendorByUserId(userId);
    assertActiveVendor(vendor);

    return {
      data: toVendorProfileDto(vendor),
    };
  }

  async function updateProfile({ userId, data }) {
    const vendor = await findVendorByUserId(userId);
    assertActiveVendor(vendor);

    const payload = {
      ...(data.businessname !== undefined && {
        businessName: data.businessname,
      }),
      ...(data.contactphone !== undefined && {
        contactPhone: toInternationalFormat(data.contactphone),
      }),
      ...(data.pickupaddress !== undefined && {
        pickupAddress: data.pickupaddress,
      }),
      ...(data.deliverynotes !== undefined && {
        deliveryNotes: data.deliverynotes,
      }),
    };

    const updated = await updateVendorById(vendor.id, payload);

    return {
      data: toVendorProfileDto(updated),
    };
  }

  return {
    getProfile,
    updateProfile,
  };
}

const vendorProfileService = createVendorProfileService({
  findVendorByUserId,
  updateVendorById,
});

export const { getProfile, updateProfile } = vendorProfileService;