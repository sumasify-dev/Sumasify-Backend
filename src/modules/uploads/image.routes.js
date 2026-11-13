import { Router } from "express";
import multer from "multer";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import { AppError } from "../../middleware/utils/AppError.js";
import { MAX_IMAGE_BYTES } from "./image.validation.js";
import { upload } from "./image.controller.js";

const router = Router();

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
});

const imageFields = multerUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

function receiveImage(req, res, next) {
  imageFields(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return next(
          new AppError(
            "Image cannot exceed 5 MB",
            400,
            "IMAGE_TOO_LARGE",
          ),
        );
      }

      return next(
        new AppError(
          "Invalid image upload",
          400,
          "INVALID_IMAGE_UPLOAD",
        ),
      );
    }

    const files = Object.values(req.files ?? {}).flat();

    if (files.length > 1) {
      return next(
        new AppError(
          "Only one image can be uploaded at a time",
          400,
          "TOO_MANY_IMAGES",
        ),
      );
    }

    req.file = files[0];
    next();
  });
}

router.post(
  "/uploads/product-images",
  authenticate,
  authorizeRoles("VENDOR"),
  receiveImage,
  upload,
);

export default router;