import {findVendorProfileByUserId,updateVendorProfileByUserId} from "./vendor-profile.model.js";

import { AppError } from "../../middleware/utils/AppError.js";

function formatVendorProfile(vendor) {
  return {
    data: {
      id: vendor.id,
      businessname: vendor.businessName,
      slug: vendor.slug,
      status: vendor.status.toLowerCase(),
      approvedat: vendor.approvedAt,
      contactphone: vendor.contactPhone,
      pickupaddress: vendor.pickupAddress,
      deliverynotes: vendor.deliveryNotes,
      createdat: vendor.createdAt,
      updatedat: vendor.updatedAt,
    },
  };
}

export async function getVendorProfile({ userId }) {
  const vendor = await findVendorProfileByUserId({ userId });

  if (!vendor) {
    throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
  }

  return formatVendorProfile(vendor);
}

export async function updateVendorProfile({ userId, updates }) {
  const vendor = await findVendorProfileByUserId({ userId });

  if (!vendor) {
    throw new AppError("Vendor profile not found", 404, "VENDOR_NOT_FOUND");
  }

  const allowedUpdates = {
    ...(updates.businessname !== undefined && {
      businessName: updates.businessname,
    }),
    ...(updates.contactphone !== undefined && {
      contactPhone: updates.contactphone,
    }),
    ...(updates.pickupaddress !== undefined && {
      pickupAddress: updates.pickupaddress,
    }),
    ...(updates.deliverynotes !== undefined && {
      deliveryNotes: updates.deliverynotes,
    }),
  };

  const updatedVendor = await updateVendorProfileByUserId({
    userId,
    updates: allowedUpdates,
  });

  return formatVendorProfile(updatedVendor);
}
