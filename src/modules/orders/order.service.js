import {
  findOrdersByBuyerId,
  countOrdersByBuyerId,
  findOrderById,
} from "./order.model.js";

import { AppError } from "../../middleware/utils/AppError.js";

function formatMoney(amount) {
  return amount.toFixed(2);
}

function formatOrderItem(item) {
  return {
    id: item.id,
    productid: item.productId,
    productname: item.productNameSnapshot,
    unitpriceamount: formatMoney(item.unitPriceAmount),
    quantity: item.quantity,
    linetotalamount: formatMoney(item.lineTotalAmount),
    imageurl: item.imageUrlSnapshot,
    vendorname: item.vendorNameSnapshot,
    createdat: item.createdAt,
  };
}

function formatVendorGroup(group) {
  return {
    id: group.id,
    groupnumber: group.groupNumber,
    vendor: {
      id: group.vendor.id,
      businessname: group.vendor.businessName,
    },
    subtotalamount: formatMoney(group.subtotalAmount),
    deliveryamount: formatMoney(group.deliveryAmount),
    commissionamount: formatMoney(group.commissionAmount),
    payoutamount: formatMoney(group.payoutAmount),
    fulfilmentstatus: group.fulfilmentStatus.toLowerCase(),
    deliverymethod: group.deliveryMethod.toLowerCase(),
    vendornotes: group.vendorNotes,
    settlementstatus: group.settlementStatus.toLowerCase(),
    items: group.orderItems.map(formatOrderItem),
  };
}

function formatOrder(order) {
  return {
    id: order.id,
    ordernumber: order.orderNumber,
    status: order.status.toLowerCase(),
    paymentstatus: order.paymentStatus.toLowerCase(),
    currency: order.currency,
    subtotalamount: formatMoney(order.subtotalAmount),
    deliveryamount: formatMoney(order.deliveryAmount),
    totalamount: formatMoney(order.totalAmount),
    deliveryaddresssnapshot: order.deliveryAddressSnapshot,
    placedat: order.placedAt,
    cancelledat: order.cancelledAt,
    createdat: order.createdAt,
    updatedat: order.updatedAt,
    vendorgroups: order.vendorOrderGroups.map(formatVendorGroup),
  };
}

export function createOrderService({
  findOrdersByBuyerId,
  countOrdersByBuyerId,
  findOrderById,
}) {
  async function getBuyerOrders({
    buyerId,
    status,
    page,
    pageSize,
  }) {
    const skip = (page - 1) * pageSize;
    const prismaStatus = status?.toUpperCase();

    const [orders, total] = await Promise.all([
      findOrdersByBuyerId({
        buyerId,
        status: prismaStatus,
        skip,
        take: pageSize,
      }),
      countOrdersByBuyerId({
        buyerId,
        status: prismaStatus,
      }),
    ]);

    return {
      data: orders.map(formatOrder),
      meta: {
        page,
        pagesize: pageSize,
        total,
        totalpages: Math.ceil(total / pageSize),
      },
    };
  }

  async function getOrderById({
    orderId,
    userId,
    userRole,
  }) {
    const order = await findOrderById({ orderId });

    if (!order) {
      throw new AppError(
        "Order not found",
        404,
        "ORDER_NOT_FOUND"
      );
    }

    if (userRole !== "admin" && order.buyerId !== userId) {
      throw new AppError(
        "You are not authorized to access this order",
        403,
        "ORDER_FORBIDDEN"
      );
    }

    return formatOrder(order);
  }

  return {
    getBuyerOrders,
    getOrderById,
  };
}

// Production instance: uses the actual order model functions.
const orderService = createOrderService({
  findOrdersByBuyerId,
  countOrdersByBuyerId,
  findOrderById,
});

// Preserve the existing named exports used by the controllers.
export const {
  getBuyerOrders,
  getOrderById,
} = orderService;