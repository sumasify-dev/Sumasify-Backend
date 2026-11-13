import { v2 as cloudinary } from "cloudinary";

import { AppError } from "../../middleware/utils/AppError.js";

export function createCloudinaryImageStorage({
  cloudName,
  apiKey,
  apiSecret,
  folder = "sumasify/products",
}) {
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  return {
    upload(buffer, { contentType }) {
      if (!cloudName || !apiKey || !apiSecret) {
        throw new AppError(
          "Image storage is not configured",
          503,
          "IMAGE_STORAGE_UNAVAILABLE",
        );
      }

      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: "image",
            use_filename: true,
            unique_filename: true,
            overwrite: false,
            context: {
              contenttype: contentType,
            },
          },
          (error, result) => {
            if (error || !result) {
              reject(
                new AppError(
                  "Image upload failed",
                  502,
                  "IMAGE_UPLOAD_FAILED",
                ),
              );
              return;
            }

            resolve({
              storagekey: result.public_id,
              url: result.secure_url,
              width: result.width ?? null,
              height: result.height ?? null,
              bytes: result.bytes,
            });
          },
        );

        stream.end(buffer);
      });
    },
  };
}

export const imageStorage = createCloudinaryImageStorage({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
  folder: process.env.CLOUDINARY_PRODUCT_FOLDER,
});