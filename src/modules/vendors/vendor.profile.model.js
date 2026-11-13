import prisma from "../../config/prisma.js";

export function findVendorByUserId(userId) {
  return prisma.vendor.findUnique({
    where: {
      userId,
    },
  });
}

export function updateVendorById(vendorId, data) {
  return prisma.vendor.update({
    where: {
      id: vendorId,
    },
    data,
  });
}