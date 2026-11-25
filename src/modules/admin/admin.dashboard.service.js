import prisma from "../../config/prisma.js";

export async function getAdminDashboard() {
  const [
    pendingVendorApplications,
    activeProducts,
    pendingModerationProducts,
    pendingPaymentReviewOrders,
    ordersInFulfilment,
    completedOrders,
    submittedPayments,
  ] = await Promise.all([
    prisma.vendorApplication.count({
      where: {
        status: "PENDING",
      },
    }),

    prisma.product.count({
      where: {
        status: "ACTIVE",
      },
    }),

    // Implementation mapping: DRAFT represents products awaiting moderation.
    prisma.product.count({
      where: {
        status: "DRAFT",
      },
    }),

    prisma.order.count({
      where: {
        status: "PAYMENT_REVIEW",
      },
    }),

    prisma.order.count({
      where: {
        status: "IN_FULFILMENT",
      },
    }),

    prisma.order.count({
      where: {
        status: "COMPLETED",
      },
    }),

    prisma.payment.count({
      where: {
        status: "SUBMITTED",
      },
    }),
  ]);

  return {
    vendorapplications: {
      pending: pendingVendorApplications,
    },

    products: {
      active: activeProducts,
      pendingmoderation: pendingModerationProducts,
    },

    orders: {
      pendingpaymentreview: pendingPaymentReviewOrders,
      infulfilment: ordersInFulfilment,
      completed: completedOrders,
    },

    payments: {
      submitted: submittedPayments,
    },
  };
}
