import {getVendorProfile,updateVendorProfile} from "./vendor-profile.service.js";

import { updateVendorProfileBodySchema } from "./vendor-profile.validation.js";

import { asyncHandler } from "../../middleware/utils/asyncHandler.js";

export function getMyVendorProfile(req, res) {
  return asyncHandler(async () => {
    const result = await getVendorProfile({
      userId: req.user.id,
    });

    res.status(200).json(result);
  })(req, res);
}

export function updateMyVendorProfile(req, res) {
  return asyncHandler(async () => {
    const updates = updateVendorProfileBodySchema.parse(req.body);

    const result = await updateVendorProfile({
      userId: req.user.id,
      updates,
    });

    res.status(200).json(result);
  })(req, res);
}