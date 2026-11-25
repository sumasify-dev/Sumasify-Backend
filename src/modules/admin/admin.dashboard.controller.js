import { asyncHandler } from "../../middleware/utils/asyncHandler.js";
import { AppError } from "../../middleware/utils/AppError.js";

import { getAdminDashboard } from "./admin.dashboard.service.js";

export const getDashboard = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== "admin") {
    throw new AppError(
      "You do not have permission to access the admin dashboard.",
      403,
      "FORBIDDEN",
    );
  }

  const data = await getAdminDashboard();

  return res.status(200).json({
    data,
  });
});
