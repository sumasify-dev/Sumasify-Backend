import prisma from "../../config/prisma.js";

export function findPendingApplicationByUserId(userId) {
  return prisma.vendorApplication.findFirst({
    where: {
      userId,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export function findLatestApplicationByUserId(userId) {
  return prisma.vendorApplication.findFirst({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export function createVendorApplication({ userId, data }) {
  return prisma.$transaction(async (tx) => {
    // Serialize submissions for the same buyer so two concurrent requests
    // cannot both create a PENDING application.
    await tx.$queryRaw`
      SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE
    `;

    const pending = await tx.vendorApplication.findFirst({
      where: {
        userId,
        status: "PENDING",
      },
      select: {
        id: true,
      },
    });

    if (pending) {
      return null;
    }

    return tx.vendorApplication.create({
      data: {
        userId,
        businessName: data.businessname,
        contactPhone: data.contactphone,
        description: data.description ?? null,
        categoryNotes: data.categorynotes ?? null,
        status: "PENDING",
      },
    });
  });
}