import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import { updateVendorProfileSchema } from "./vendor.profile.validation.js";
import {
  getProfile,
  updateProfile,
} from "./vendor.profile.service.js";

export function createVendorProfileController({
  getProfile,
  updateProfile,
}) {
  const get = asyncHandler(async (req, res) => {
    const result = await getProfile({
      userId: req.user.id,
    });

    res.status(200).json(result);
  });

  const update = asyncHandler(async (req, res) => {
    const data = updateVendorProfileSchema.parse(req.body);

    const result = await updateProfile({
      userId: req.user.id,
      data,
    });

    res.status(200).json(result);
  });

  return {
    get,
    update,
  };
}

const vendorProfileController = createVendorProfileController({
  getProfile,
  updateProfile,
});

export const { get, update } = vendorProfileController;