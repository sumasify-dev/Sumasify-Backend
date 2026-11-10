import prisma from "../../config/prisma.js";

// Find the vendor associated with the authenticated user.
export async function findVendorForProductOperations({ userId }) {
  return prisma.vendor.findUnique({
    where: { userId },
    select: {
      id: true,
      status: true,
      approvedAt: true,
    },
  });
}

// Check whether a category exists and is active.
export async function findActiveCategoryById({ categoryId }) {
  return prisma.category.findFirst({
    where: {
      id: categoryId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });
}

// Retrieve products belonging to a specific vendor.
export async function findVendorProducts({
  vendorId,
  skip,
  take,
  status,
}) {
  return prisma.product.findMany({
    where: {
      vendorId,
      ...(status && { status }),
    },
    skip,
    take,
    orderBy: {
      createdAt: "desc",
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      images: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });
}

// Count products for pagination.
export async function countVendorProducts({ vendorId, status }) {
  return prisma.product.count({
    where: {
      vendorId,
      ...(status && { status }),
    },
  });
}

// Find a product by ID.
export async function findProductById({ productId }) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      images: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });
}

// Create a product and its associated images.
export async function createVendorProduct({
  vendorId,
  categoryId,
  name,
  description,
  priceAmount,
  stockOnHand,
  imageRecords,
}) {
  return prisma.product.create({
    data: {
      vendorId,
      categoryId,
      name,
      description,
      priceAmount,
      stockOnHand,

      // Product publication is controlled by the backend.
      status: "DRAFT",
      isAvailable: false,
      publishedAt: null,

      images: {
        create: imageRecords.map((image, index) => ({
          storageKey: image.storageKey,
          url: image.url,
          altText: image.altText ?? null,
          position: index,
          width: image.width ?? null,
          height: image.height ?? null,
          bytes: image.bytes ?? null,
        })),
      },
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      images: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });
}

// Update an existing product.
export async function updateVendorProduct({
  productId,
  updates,
}) {
  return prisma.product.update({
    where: {
      id: productId,
    },
    data: updates,
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      images: {
        orderBy: {
          position: "asc",
        },
      },
    },
  });
}