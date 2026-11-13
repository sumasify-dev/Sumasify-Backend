import { AppError } from "../../middleware/utils/AppError.js";
import { findVendorByUserId } from "../vendors/vendor.profile.model.js";
import { validateImageFile } from "./image.validation.js";
import { createProductImageUpload } from "./image.model.js";
import { imageStorage } from "./image.storage.js";

export function createImageUploadService({
  findVendorByUserId,
  createProductImageUpload,
  storage,
}) {
  async function requireActiveVendor(userId) {
    const vendor = await findVendorByUserId(userId);

    if (!vendor) {
      throw new AppError(
        "Only approved vendors can upload product images",
        403,
        "VENDOR_NOT_APPROVED",
      );
    }

    if (vendor.status !== "ACTIVE") {
      throw new AppError(
        "This vendor account is not active",
        403,
        "VENDOR_INACTIVE",
      );
    }

    return vendor;
  }

  async function uploadProductImage({ userId, file }) {
    const vendor = await requireActiveVendor(userId);
    const validated = validateImageFile(file);

    const uploaded = await storage.upload(file.buffer, {
      contentType: validated.contentType,
    });

    const upload = await createProductImageUpload({
      vendorId: vendor.id,
      storageKey: uploaded.storagekey,
      url: uploaded.url,
      contentType: validated.contentType,
      width: uploaded.width ?? null,
      height: uploaded.height ?? null,
      bytes: uploaded.bytes ?? validated.size,
    });

    return {
      data: {
        uploadid: upload.id,
        url: upload.url,
        storagekey: upload.storageKey,
        contenttype: upload.contentType,
        width: upload.width,
        height: upload.height,
        bytes: upload.bytes,
      },
    };
  }

  return {
    uploadProductImage,
  };
}

const imageUploadService = createImageUploadService({
  findVendorByUserId,
  createProductImageUpload,
  storage: imageStorage,
});

export const { uploadProductImage } = imageUploadService;