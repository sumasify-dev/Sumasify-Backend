import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import {
  vendorOrderListSchema,
  vendorOrderGroupIdSchema,
  updateVendorOrderStatusSchema,
} from "./vendor.order.validation.js";
import {
  listOrders,
  getOrder,
  updateOrderStatus,
} from "./vendor.order.service.js";

export function createVendorOrderController({
  listOrders,
  getOrder,
  updateOrderStatus,
}) {
  const list = asyncHandler(async (req, res) => {
    const query = vendorOrderListSchema.parse(req.query);

    const result = await listOrders({
      userId: req.user.id,
      ...query,
    });

    res.status(200).json(result);
  });

  const get = asyncHandler(async (req, res) => {
    const { groupid } = vendorOrderGroupIdSchema.parse(req.params);

    const result = await getOrder({
      userId: req.user.id,
      groupId: groupid,
    });

    res.status(200).json(result);
  });

  const updateStatus = asyncHandler(async (req, res) => {
    const { groupid } = vendorOrderGroupIdSchema.parse(req.params);
    const data = updateVendorOrderStatusSchema.parse(req.body);

    const result = await updateOrderStatus({
      userId: req.user.id,
      groupId: groupid,
      status: data.status.toUpperCase(),
      vendornotes: data.vendornotes,
    });

    res.status(200).json(result);
  });

  return {
    list,
    get,
    updateStatus,
  };
}

const vendorOrderController = createVendorOrderController({
  listOrders,
  getOrder,
  updateOrderStatus,
});

export const { list, get, updateStatus } = vendorOrderController;