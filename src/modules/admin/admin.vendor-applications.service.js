import prisma from "../../config/prisma.js";
import { AppError } from "../../middleware/utils/AppError.js";

function createVendorSlug(businessName, applicationId) {
  const baseSlug = businessName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Application ID suffix makes the generated slug deterministic
  // and avoids collisions between businesses with the same name.
  return `${baseSlug || "vendor"}-${applicationId.slice(0, 8)}`;
}

export async function listVendorApplications({ status, page, pageSize }) {
  const where = status ? { status } : {};

  const [applications, total] = await Promise.all([
    prisma.vendorApplication.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneE164: true,
            role: true,
            accountStatus: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    }),

    prisma.vendorApplication.count({ where }),
  ]);

  return {
    data: applications,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function reviewVendorApplication({
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
              accountStatus: true,
              vendor: true,
            },
          },
        },
      });

      if (!application) {
        throw new AppError(
          "Vendor application not found.",
          404,
          "VENDOR_APPLICATION_NOT_FOUND",
        );
      }

      if (application.status !== "PENDING") {
        throw new AppError(
          "This vendor application has already been reviewed or withdrawn.",
          409,
          "INVALID_APPLICATION_STATE",
        );
      }

      if (application.user.accountStatus !== "ACTIVE") {
        throw new AppError(
          "The applicant account is not active.",
          409,
          "APPLICANT_ACCOUNT_INACTIVE",
        );
      }

      const now = new Date();

      // Conditional update protects against two administrators
      // reviewing the same pending application concurrently.
      const applicationUpdate = await tx.vendorApplication.updateMany({
        where: {
          id: applicationId,
          status: "PENDING",
        },
        data: {
          status: decision,
          reviewedById: adminUserId,
          reviewedAt: now,
          rejectionReason: decision === "REJECTED" ? rejectionReason : null,
        },
      });

      if (applicationUpdate.count !== 1) {
        throw new AppError(
          "This vendor application has already been reviewed.",
          409,
          "INVALID_APPLICATION_STATE",
        );
      }

      let vendor = null;

      if (decision === "APPROVED") {
        const vendorData = {
          businessName: application.businessName,
          contactPhone: application.contactPhone,
          status: "ACTIVE",
          approvedAt: now,
          approvedById: adminUserId,
        };

        vendor = await tx.vendor.upsert({
          where: {
            userId: application.userId,
          },
          update: vendorData,
          create: {
            userId: application.userId,
            ...vendorData,
            slug: createVendorSlug(application.businessName, application.id),
          },
        });

        // Vendor access is granted only after approval.
        await tx.user.update({
          where: {
            id: application.userId,
          },
          data: {
            role: "VENDOR",
          },
        });
      }

      const updatedApplication = await tx.vendorApplication.findUnique({
        where: {
          id: applicationId,
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneE164: true,
              role: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      await tx.adminAuditLog.create({
        data: {
          adminUserId,
          action:
            decision === "APPROVED"
              ? "VENDOR_APPLICATION_APPROVED"
              : "VENDOR_APPLICATION_REJECTED",
          entityType: "VENDOR_APPLICATION",
          entityId: applicationId,
          before: {
            status: application.status,
            userRole: application.user.role,
            rejectionReason: application.rejectionReason,
          },
          after: {
            status: decision,
            userRole:
              decision === "APPROVED" ? "VENDOR" : application.user.role,
            rejectionReason: decision === "REJECTED" ? rejectionReason : null,
            vendorId: vendor?.id ?? null,
          },
        },
      });

      return {
        application: updatedApplication,
        vendor,
      };
    },
    {
      isolationLevel: "Serializable",
      maxWait: 10000,
      timeout: 20000,
    },
  );
}
