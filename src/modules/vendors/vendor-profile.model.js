import prisma from "../../config/prisma.js";

export async function findVendorProfileByUserId({ userId }) {
  return prisma.vendor.findUnique({
    where: { userId },
    select: {
      id: true,
      businessName: true,
      slug: true,
      status: true,
      approvedAt: true,
      contactPhone: true,
      pickupAddress: true,
      deliveryNotes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateVendorProfileByUserId({ userId, updates }) {
  return prisma.vendor.update({
    where: { userId },
    data: updates,
    select: {
      id: true,
      businessName: true,
      slug: true,
      status: true,
      approvedAt: true,
      contactPhone: true,
      pickupAddress: true,
      deliveryNotes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}