import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import { list, decide } from "./admin.vendor.application.controller.js";

const router = Router();

router.get(
  "/admin/vendor-applications",
  authenticate,
  authorizeRoles("ADMIN"),
  list,
);

router.patch(
  "/admin/vendor-applications/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  decide,
);

export default router;