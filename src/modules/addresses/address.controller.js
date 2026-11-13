import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import { createAddressSchema } from "./address.validation.js";
import {
  listBuyerAddresses,
  createBuyerAddress,
} from "./address.service.js";

export const listAddresses = asyncHandler(async (req, res) => {
  const addresses = await listBuyerAddresses(req.user.id);

  res.status(200).json({
    data: addresses,
  });
});

export const createAddress = asyncHandler(async (req, res) => {
  const data = createAddressSchema.parse(req.body);

  const address = await createBuyerAddress({
    userId: req.user.id,
    data,
  });

  res.status(201).json({
    data: address,
  });
});