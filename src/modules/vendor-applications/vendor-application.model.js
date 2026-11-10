import prisma from "../../config/prisma.js";

// Check whether the buyer already has a pending application.
export async function findPendingVendorApplication({ userId }) {
  return prisma.vendorApplication.findFirst({
    where: {
      userId,
      status: "PENDING",
    },
    select: {
      id: true,
      status: true,
    },
  });
}

// Create a new vendor application.
export async function createVendorApplication({
  userId,
  businessName,
  contactPhone,
  description,
  categoryNotes,
}) {
  return prisma.vendorApplication.create({
    data: {
      userId,
      businessName,
      contactPhone,
      description,
      categoryNotes,
    },
    select: {
      id: true,
      businessName: true,
      contactPhone: true,
      description: true,
      categoryNotes: true,
      status: true,
      createdAt: true,
    },
  });
}

// Retrieve the buyer's latest vendor application.
export async function findLatestVendorApplication({ userId }) {
  return prisma.vendorApplication.findFirst({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      status: true,
      businessName: true,
      contactPhone: true,
      description: true,
      rejectionReason: true,
    },
  });
}