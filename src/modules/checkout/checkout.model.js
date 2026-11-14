import prisma from "../../config/prisma.js";

export async function findBuyerAddress(buyerId, addressId, db = prisma) {
  return db.address.findFirst({
    where: {
      id: addressId,
      userId: buyerId,
    },
  });
}

export async function findBuyerCart(buyerId, db = prisma) {
  return db.cart.findUnique({
    where: { buyerId },
    include: {
      items: {
        orderBy: { addedAt: "asc" },
        include: {
          product: {
            include: {
              vendor: {
                select: {
                  id: true,
                  businessName: true,
                  status: true,
                  deliveryFeeAmount: true,
                  pickupAddress: true,
                  deliveryNotes: true,
                },
              },
              category: {
                select: {
                  id: true,
                  isActive: true,
                },
              },
              images: {
                orderBy: { position: "asc" },
                take: 1,
                select: {
                  url: true,
                  altText: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function findCheckoutByIdempotencyKey(key, db = prisma) {
  return db.payment.findUnique({
    where: { idempotencyKey: key },
    include: {
      order: {
        include: {
          vendorOrderGroups: {
            orderBy: { groupNumber: "asc" },
            include: {
              vendor: {
                select: {
                  id: true,
                  businessName: true,
                },
              },
              orderItems: {
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
    },
  });
}

export async function runCheckoutTransaction(callback) {
  return prisma.$transaction(callback, {
    isolationLevel: "Serializable",
    maxWait: 10000,
    timeout: 20000,
  });
}
