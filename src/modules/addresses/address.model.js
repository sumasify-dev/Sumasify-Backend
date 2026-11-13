import prisma from "../../config/prisma.js";

export function findAddressesByUserId(userId) {
  return prisma.address.findMany({
    where: {
      userId,
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}



export function createAddressForUser({ userId, data }) {
  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.address.count({
      where: {
        userId,
      },
    });

    const isDefault = data.isdefault === true || existingCount === 0;

    if (isDefault) {
      await tx.address.updateMany({
        where: {
          userId,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return tx.address.create({
      data: {
        userId,
        label: data.label ?? null,
        recipientName: data.recipientname,
        phone: data.phone,
        areaCode: data.areacode ?? null,
        addressLine: data.addressline,
        instructions: data.instructions ?? null,
        isDefault,
      },
    });
  });
}