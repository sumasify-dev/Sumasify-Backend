import prisma from "../../config/prisma.js";

export function createProductImageUpload({
  vendorId,
  storageKey,
  url,
  contentType,
  width,
  height,
  bytes,
}) {
  return prisma.productImageUpload.create({
    data: {
      vendorId,
      storageKey,
      url,
      contentType,
      width,
      height,
      bytes,
    },
  });
}