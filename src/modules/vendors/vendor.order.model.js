import prisma from "../../config/prisma.js";
import { AppError } from "../../middleware/utils/AppError.js";

const vendorOrderInclude = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      deliveryAddressSnapshot: true,
      placedAt: true,
    },
  },
  orderItems: {
    orderBy: {
      createdAt: "asc",
    },
  },
};

export const NEXT_FULFILMENT_STATUS = Object.freeze({
  NEW: "CONFIRMED",
  CONFIRMED: "READY",
  READY: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
  DELIVERED: "COMPLETED",
});

export function findVendorOrders({
  vendorId,
  status,
  skip,
  take,
}) {
  return prisma.vendorOrderGroup.findMany({
    where: {
      vendorId,
      ...(status ? { fulfilmentStatus: status } : {}),
    },
    include: vendorOrderInclude,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
  });
}

export function countVendorOrders({ vendorId, status }) {
  return prisma.vendorOrderGroup.count({
    where: {
      vendorId,
      ...(status ? { fulfilmentStatus: status } : {}),
    },
  });
}

export function findVendorOrderById({ groupId, vendorId }) {
  return prisma.vendorOrderGroup.findFirst({
    where: {
      id: groupId,
      vendorId,
    },
    include: vendorOrderInclude,
  });
}

export function deriveParentOrderStatus(groupStatuses) {
  const allFinished = groupStatuses.every((status) =>
    ["DELIVERED", "COMPLETED", "CANCELLED"].includes(status),
  );

  if (allFinished) {
    return "COMPLETED";
  }

  const started = groupStatuses.some(
    (status) =>
      status !== "PENDING_PAYMENT" && status !== "NEW",
  );

  return started ? "IN_FULFILMENT" : null;
}

export function updateVendorOrderStatus({
  groupId,
  vendorId,
  status,
  vendorNotes,
}) {
  return prisma.$transaction(
    async (tx) => {
      const group = await tx.vendorOrderGroup.findFirst({
        where: {
          id: groupId,
          vendorId,
        },
        select: {
          id: true,
          orderId: true,
          fulfilmentStatus: true,
          settlementStatus: true,
        },
      });

      if (!group) {
        return null;
      }

      const nextStatus =
        NEXT_FULFILMENT_STATUS[group.fulfilmentStatus];

      if (nextStatus !== status) {
        throw new AppError(
          `Cannot move fulfilment status from ${group.fulfilmentStatus.toLowerCase()} to ${status.toLowerCase()}`,
          409,
          "INVALID_FULFILMENT_TRANSITION",
        );
      }

      const data = {
        fulfilmentStatus: status,
        ...(vendorNotes !== undefined && { vendorNotes }),
        ...(["DELIVERED", "COMPLETED"].includes(status) &&
          group.settlementStatus === "PENDING" && {
            settlementStatus: "ELIGIBLE_AFTER_DELIVERY",
          }),
      };

      const claimed = await tx.vendorOrderGroup.updateMany({
        where: {
          id: groupId,
          vendorId,
          fulfilmentStatus: group.fulfilmentStatus,
        },
        data,
      });

      if (claimed.count !== 1) {
        throw new AppError(
          "The vendor order group was updated by another request",
          409,
          "FULFILMENT_TRANSITION_CONFLICT",
        );
      }

      const order = await tx.order.findUnique({
        where: {
          id: group.orderId,
        },
        select: {
          status: true,
        },
      });

      if (order && ["PAID", "IN_FULFILMENT"].includes(order.status)) {
        const groups = await tx.vendorOrderGroup.findMany({
          where: {
            orderId: group.orderId,
          },
          select: {
            fulfilmentStatus: true,
          },
        });

        const derived = deriveParentOrderStatus(
          groups.map((item) => item.fulfilmentStatus),
        );

        if (derived && derived !== order.status) {
          await tx.order.update({
            where: {
              id: group.orderId,
            },
            data: {
              status: derived,
            },
          });
        }
      }

      return tx.vendorOrderGroup.findUnique({
        where: {
          id: groupId,
        },
        include: vendorOrderInclude,
      });
    },
    {
      maxWait: 5000,
      timeout: 15000,
    },
  );
}