import { AppError } from "../../middleware/utils/AppError.js";
import { findVendorByUserId } from "./vendor.profile.model.js";
import {
  findVendorOrders,
  countVendorOrders,
  findVendorOrderById,
  updateVendorOrderStatus,
} from "./vendor.order.model.js";

function formatMoney(amount) {
  return Number(amount).toFixed(2);
}

function formatVendorOrderItem(item) {
  return {
    id: item.id,
    productid: item.productId,
    productname: item.productNameSnapshot,
    unitpriceamount: formatMoney(item.unitPriceAmount),
    quantity: item.quantity,
    linetotalamount: formatMoney(item.lineTotalAmount),
    imageurl: item.imageUrlSnapshot,
    vendorname: item.vendorNameSnapshot,
  };
}

function toVendorOrderDto(group) {
  return {
    id: group.id,
    groupnumber: group.groupNumber,
    order: {
      id: group.order.id,
      ordernumber: group.order.orderNumber,
      status: group.order.status.toLowerCase(),
      paymentstatus: group.order.paymentStatus.toLowerCase(),
      placedat: group.order.placedAt,
    },
    deliverysnapshot: group.order.deliveryAddressSnapshot,
    deliverymethod: group.deliveryMethod.toLowerCase(),
    subtotalamount: formatMoney(group.subtotalAmount),
    deliveryamount: formatMoney(group.deliveryAmount),
    commissionamount: formatMoney(group.commissionAmount),
    payoutamount: formatMoney(group.payoutAmount),
    fulfilmentstatus: group.fulfilmentStatus.toLowerCase(),
    settlementstatus: group.settlementStatus.toLowerCase(),
    vendornotes: group.vendorNotes,
    items: group.orderItems.map(formatVendorOrderItem),
    createdat: group.createdAt,
    updatedat: group.updatedAt,
  };
}

export function createVendorOrderService({
  findVendorByUserId,
  findVendorOrders,
  countVendorOrders,
  findVendorOrderById,
  updateVendorOrderStatus,
}) {
  async function requireActiveVendor(userId) {
    const vendor = await findVendorByUserId(userId);

    if (!vendor) {
      throw new AppError(
        "Only approved vendors can access vendor orders",
        403,
        "VENDOR_NOT_APPROVED",
      );
    }

    if (vendor.status !== "ACTIVE") {
      throw new AppError(
        "This vendor account is not active",
        403,
        "VENDOR_INACTIVE",
      );
    }

    return vendor;
  }

  async function listOrders({ userId, status, page, pageSize }) {
    const vendor = await requireActiveVendor(userId);
    const skip = (page - 1) * pageSize;

    const [groups, total] = await Promise.all([
      findVendorOrders({
        vendorId: vendor.id,
        status,
        skip,
        take: pageSize,
      }),
      countVendorOrders({
        vendorId: vendor.id,
        status,
      }),
    ]);

    return {
      data: groups.map(toVendorOrderDto),
      meta: {
        page,
        pagesize: pageSize,
        total,
        totalpages: Math.ceil(total / pageSize),
      },
    };
  }

  async function getOrder({ userId, groupId }) {
    const vendor = await requireActiveVendor(userId);

    const group = await findVendorOrderById({
      groupId,
      vendorId: vendor.id,
    });

    if (!group) {
      throw new AppError(
        "Vendor order group not found",
        404,
        "VENDOR_ORDER_NOT_FOUND",
      );
    }

    return {
      data: toVendorOrderDto(group),
    };
  }

  async function updateOrderStatus({
    userId,
    groupId,
    status,
    vendornotes,
  }) {
    const vendor = await requireActiveVendor(userId);

    const existing = await findVendorOrderById({
      groupId,
      vendorId: vendor.id,
    });

    if (!existing) {
      throw new AppError(
        "Vendor order group not found",
        404,
        "VENDOR_ORDER_NOT_FOUND",
      );
    }

    const group = await updateVendorOrderStatus({
      groupId,
      vendorId: vendor.id,
      status,
      vendorNotes: vendornotes,
    });

    if (!group) {
      throw new AppError(
        "Vendor order group not found",
        404,
        "VENDOR_ORDER_NOT_FOUND",
      );
    }

    return {
      data: toVendorOrderDto(group),
    };
  }

  return {
    listOrders,
    getOrder,
    updateOrderStatus,
  };
}

const vendorOrderService = createVendorOrderService({
  findVendorByUserId,
  findVendorOrders,
  countVendorOrders,
  findVendorOrderById,
  updateVendorOrderStatus,
});

export const { listOrders, getOrder, updateOrderStatus } =
  vendorOrderService;