import prisma from "../../config/prisma.js";

// Find a product and retrieve its current inventory values.
export async function findVendorProductInventory({
  productId,
}) {
  return prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
      vendorId: true,
      stockOnHand: true,
      stockReserved: true,
    },
  });
}

// Update stock only if the requested quantity
// is not below the currently reserved quantity.
export async function updateVendorProductInventory({
  productId,
  vendorId,
  stockOnHand,
}) {
  return prisma.product.updateMany({
    where: {
      id: productId,
      vendorId,
      stockReserved: {
        lte: stockOnHand,
      },
    },
    data: {
      stockOnHand,
    },
  });
}

// Retrieve the updated inventory.
export async function findUpdatedVendorProductInventory({
  productId,
}) {
  return prisma.product.findUnique({
    where: {
      id: productId,
    },
    select: {
      id: true,
      stockOnHand: true,
      stockReserved: true,
    },
  });
}