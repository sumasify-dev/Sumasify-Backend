import prisma from "../../config/prisma.js";
import { AppError } from "../../middleware/utils/AppError.js";

const applicationUserSelect = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      vendor: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  },
};

export function findVendorApplicationsWithUsers({
  status,
  skip,
  take,
}) {
  return prisma.vendorApplication.findMany({
    where: {
      ...(status ? { status } : {}),
    },
    include: applicationUserSelect,
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
  });
}

export function countVendorApplications({ status }) {
  return prisma.vendorApplication.count({
    where: {
      ...(status ? { status } : {}),
    },
  });
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function buildUniqueVendorSlug({
  tx,
  businessName,
  applicationId,
}) {
  const base = slugify(businessName) || "vendor";

  const existing = await tx.vendor.findUnique({
    where: {
      slug: base,
    },
    select: {
      id: true,
    },
  });

  return existing ? `${base}-${applicationId.slice(0, 8)}` : base;
}

export function applyVendorApplicationDecision({
  applicationId,
  adminUserId,
  decision,
  rejectionReason,
}) {
  return prisma.$transaction(
    async (tx) => {
      const application = await tx.vendorApplication.findUnique({
        where: {
          id: applicationId,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              vendor: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!application) {
        throw new AppError(
          "Vendor application not found",
          404,
          "VENDOR_APPLICATION_NOT_FOUND",
        );
      }

      if (application.status !== "PENDING") {
        throw new AppError(
          "This vendor application has already been finalised",
          409,
          "VENDOR_APPLICATION_NOT_PENDING",
        );
      }

      const now = new Date();
      const isApproved = decision === "APPROVED";

      const claimed = await tx.vendorApplication.updateMany({
        where: {
          id: applicationId,
          status: "PENDING",
        },
        data: {
          status: decision,
          reviewedById: adminUserId,
          reviewedAt: now,
          rejectionReason: isApproved ? null : rejectionReason,
        },
      });

      if (claimed.count !== 1) {
        throw new AppError(
          "This vendor application has already been finalised",
          409,
          "VENDOR_APPLICATION_NOT_PENDING",
        );
      }

      let vendor = null;

      if (isApproved) {
        if (application.user.role === "ADMIN") {
          throw new AppError(
            "An administrator account cannot be promoted to vendor",
            409,
            "VENDOR_APPLICATION_ROLE_CONFLICT",
          );
        }

        vendor = application.user.vendor;

        if (vendor) {
          vendor = await tx.vendor.update({
            where: {
              id: vendor.id,
            },
            data: {
              businessName: application.businessName,
              contactPhone: application.contactPhone,
              status: "ACTIVE",
              approvedAt: now,
              approvedById: adminUserId,
            },
          });
        } else {
          const slug = await buildUniqueVendorSlug({
            tx,
            businessName: application.businessName,
            applicationId: application.id,
          });

          vendor = await tx.vendor.create({
            data: {
              userId: application.userId,
              businessName: application.businessName,
              slug,
              contactPhone: application.contactPhone,
              status: "ACTIVE",
              approvedAt: now,
              approvedById: adminUserId,
            },
          });
        }

        if (application.user.role !== "VENDOR") {
          await tx.user.update({
            where: {
              id: application.userId,
            },
            data: {
              role: "VENDOR",
            },
          });
        }
      }

      await tx.adminAuditLog.create({
        data: {
          adminUserId,
          action: isApproved
            ? "VENDOR_APPLICATION_APPROVED"
            : "VENDOR_APPLICATION_REJECTED",
          entityType: "VendorApplication",
          entityId: applicationId,
          before: {
            status: application.status,
            userid: application.userId,
            userrole: application.user.role,
          },
          after: {
            status: decision,
            userid: application.userId,
            userrole: isApproved
              ? "VENDOR"
              : application.user.role,
            vendorid: vendor?.id ?? null,
            vendorstatus: vendor?.status ?? null,
            rejectionreason: isApproved ? null : rejectionReason,
          },
        },
      });

      const updatedApplication =
        await tx.vendorApplication.findUnique({
          where: {
            id: applicationId,
          },
          include: applicationUserSelect,
        });

      return {
        application: updatedApplication,
        vendor,
      };
    },
    {
      maxWait: 5000,
      timeout: 15000,
    },
  );
}