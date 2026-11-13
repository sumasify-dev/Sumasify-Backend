import prisma from "../../config/prisma.js";
import { AppError } from "../../middleware/utils/AppError.js";

export const vendorProductSelect = {
  id: true,
  name: true,
  description: true,
  priceAmount: true,
  currency: true,
  stockOnHand: true,
  stockReserved: true,
  status: true,
  isAvailable: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  images: {
    select: {
      id: true,
      storageKey: true,
      url: true,
      altText: true,
      position: true,
      width: true,
      height: true,
      bytes: true,
    },
    orderBy: {
      position: "asc",
    },
  },
};

const inventorySelect = {
  id: true,
  stockOnHand: true,
  stockReserved: true,
};

async function claimUploads(tx, { vendorId, imageIds, now }) {
  const uniqueIds = new Set(imageIds);

  if (uniqueIds.size !== imageIds.length) {
    throw new AppError(
      "Image ids must be unique",
      400,
      "INVALID_IMAGE_IDS",
    );
  }

  const uploads = await tx.productImageUpload.findMany({
    where: {
      id: {
        in: imageIds,
      },
      vendorId,
    },
    select: {
      id: true,
      storageKey: true,
      url: true,
      contentType: true,
      width: true,
      height: true,
      bytes: true,
      attachedAt: true,
    },
  });

  if (uploads.length !== imageIds.length) {
    throw new AppError(
      "One or more image uploads were not found",
      404,
      "IMAGE_UPLOAD_NOT_FOUND",
    );
  }

  if (uploads.some((upload) => upload.attachedAt !== null)) {
    throw new AppError(
      "One or more image uploads have already been attached",
      409,
      "IMAGE_UPLOAD_ALREADY_ATTACHED",
    );
  }

  const claimed = await tx.productImageUpload.updateMany({
    where: {
      id: {
        in: imageIds,
      },
      vendorId,
      attachedAt: null,
    },
    data: {
      attachedAt: now,
    },
  });

  if (claimed.count !== imageIds.length) {
    throw new AppError(
      "One or more image uploads have already been attached",
      409,
      "IMAGE_UPLOAD_ALREADY_ATTACHED",
    );
  }

  const byId = new Map(
    uploads.map((upload) => [upload.id, upload]),
  );

  return imageIds.map((id) => byId.get(id));
}

export function findVendorProducts({
  vendorId,
  status,
  skip,
  take,
}) {
  return prisma.product.findMany({
    where: {
      vendorId,
      ...(status ? { status } : {}),
    },
    select: vendorProductSelect,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
  });
}

export function countVendorProducts({ vendorId, status }) {
  return prisma.product.count({
    where: {
      vendorId,
      ...(status ? { status } : {}),
    },
  });
}

export function findVendorProductById({ productId, vendorId }) {
  return prisma.product.findFirst({
    where: {
      id: productId,
      vendorId,
    },
    select: vendorProductSelect,
  });
}

export function findCategoryById(categoryId) {
  return prisma.category.findUnique({
    where: {
      id: categoryId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
    },
  });
}

export function createVendorProductTransaction({
  vendorId,
  data,
  imageIds,
  now,
}) {
  return prisma.$transaction(
    async (tx) => {
      const uploads = imageIds?.length
        ? await claimUploads(tx, {
            vendorId,
            imageIds,
            now,
          })
        : [];

      return tx.product.create({
        data: {
          vendorId,
          categoryId: data.categoryid,
          name: data.name,
          description: data.description,
          priceAmount: data.priceamount,
          stockOnHand: data.stockonhand,
          stockReserved: 0,
          status: "ACTIVE",
          isAvailable: data.stockonhand > 0,
          publishedAt: now,
          ...(uploads.length > 0 && {
            images: {
              create: uploads.map((upload, index) => ({
                storageKey: upload.storageKey,
                url: upload.url,
                altText: data.name,
                position: index,
                width: upload.width,
                height: upload.height,
                bytes: upload.bytes,
              })),
            },
          }),
        },
        select: vendorProductSelect,
      });
    },
    {
      maxWait: 5000,
      timeout: 15000,
    },
  );
}

export function updateVendorProductTransaction({
  productId,
  vendorId,
  data,
  imageIds,
  now,
}) {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.product.findFirst({
        where: {
          id: productId,
          vendorId,
        },
        select: {
          id: true,
          images: {
            select: {
              position: true,
            },
            orderBy: {
              position: "asc",
            },
          },
        },
      });

      if (!existing) {
        return null;
      }

      if (
        imageIds?.length &&
        existing.images.length + imageIds.length > 5
      ) {
        throw new AppError(
          "A product cannot have more than 5 images",
          409,
          "IMAGE_LIMIT_EXCEEDED",
        );
      }

      const uploads = imageIds?.length
        ? await claimUploads(tx, {
            vendorId,
            imageIds,
            now,
          })
        : [];

      if (uploads.length > 0) {
        const nextPosition =
          existing.images.length > 0
            ? existing.images[existing.images.length - 1].position + 1
            : 0;

        await tx.productImage.createMany({
          data: uploads.map((upload, index) => ({
            productId,
            storageKey: upload.storageKey,
            url: upload.url,
            altText: data.name ?? null,
            position: nextPosition + index,
            width: upload.width,
            height: upload.height,
            bytes: upload.bytes,
          })),
        });
      }

      return tx.product.update({
        where: {
          id: productId,
        },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.priceamount !== undefined && {
            priceAmount: data.priceamount,
          }),
          ...(data.categoryid !== undefined && {
            categoryId: data.categoryid,
          }),
        },
        select: vendorProductSelect,
      });
    },
    {
      maxWait: 5000,
      timeout: 15000,
    },
  );
}

export function updateVendorProductInventory({
  productId,
  vendorId,
  stockOnHand,
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findFirst({
      where: {
        id: productId,
        vendorId,
      },
      select: inventorySelect,
    });

    if (!existing) {
      return null;
    }

    const affected = await tx.$executeRaw`
      UPDATE "products"
      SET "stock_on_hand" = ${stockOnHand},
          "is_available" = (
            "status" = 'ACTIVE'
            AND ${stockOnHand} - "stock_reserved" > 0
          ),
          "updated_at" = NOW()
      WHERE "id" = ${productId}
        AND "vendor_id" = ${vendorId}
        AND "stock_reserved" <= ${stockOnHand}
    `;

    if (Number(affected) !== 1) {
      throw new AppError(
        "Requested stock is below the currently reserved stock",
        409,
        "STOCK_BELOW_RESERVED",
      );
    }

    return tx.product.findUnique({
      where: {
        id: productId,
      },
      select: inventorySelect,
    });
  });
}