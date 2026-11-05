import prisma from "../../config/prisma.js";

const orderInclude = {
  vendorOrderGroups: {
    orderBy: {
      groupNumber: "asc",
    },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
        },
      },
      orderItems: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  },
};

export async function findOrdersByBuyerId({
  buyerId,
  status,
  skip,
  take,
}) {
  return prisma.order.findMany({
    where: {
      buyerId,
      ...(status ? { status } : {}),
    },
    include: orderInclude,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
  });
}

export async function findOrderById({ orderId }) {
  return prisma.order.findUnique({
    where: {
      id: orderId,
    },
    include: orderInclude,
  });
}


export async function countOrdersByBuyerId({ buyerId, status }) {
  return prisma.order.count({
    where: {
      buyerId,
      ...(status ? { status } : {}),
    },
  });
}
