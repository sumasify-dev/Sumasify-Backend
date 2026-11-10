import {asyncHandler} from "../../middleware/utils/asyncHandler.js";
import {updateVendorInventoryParamsSchema,updateVendorInventoryBodySchema} from "./vendor-inventory.validation.js";
import {updateVendorProductInventoryService} from "./vendor-inventory.service.js";

export const updateVendorProductInventoryController = asyncHandler(
  async (req, res) => {
    // Validate route parameters.
    const params = updateVendorInventoryParamsSchema.parse(req.params);

    // Validate request body.
    const body = updateVendorInventoryBodySchema.parse(req.body);

    // Update inventory using the authenticated user's ID.
    const result = await updateVendorProductInventoryService({
      userId: req.user.id,
      productId: params.productid,
      stockOnHand: body.stockonhand,
    });

    return res.status(200).json(result);
  },
);