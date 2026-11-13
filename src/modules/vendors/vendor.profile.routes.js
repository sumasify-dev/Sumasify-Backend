import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import { get, update } from "./vendor.profile.controller.js";

const router = Router();

router.get(
  "/vendor/profile",
  authenticate,
  authorizeRoles("VENDOR"),
  get,
);

router.patch(
  "/vendor/profile",
  authenticate,
  authorizeRoles("VENDOR"),
  update,
);

export default router;