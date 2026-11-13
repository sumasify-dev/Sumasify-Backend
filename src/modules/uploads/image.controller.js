import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import { uploadProductImage } from "./image.service.js";

export function createImageController({ uploadProductImage }) {
  const upload = asyncHandler(async (req, res) => {
    const result = await uploadProductImage({
      userId: req.user.id,
      file: req.file,
    });

    res.status(201).json(result);
  });

  return {
    upload,
  };
}

const imageController = createImageController({
  uploadProductImage,
});

export const { upload } = imageController;