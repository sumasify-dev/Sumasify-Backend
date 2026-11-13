import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import {
  list,
  get,
  updateStatus,
} from "./vendor.order.controller.js";

const router = Router();

router.get(
  "/vendor/orders",
  authenticate,
  authorizeRoles("VENDOR"),
  list,
);

router.get(
  "/vendor/orders/:groupid",
  authenticate,
  authorizeRoles("VENDOR"),
  get,
);

router.patch(
  "/vendor/orders/:groupid/status",
  authenticate,
  authorizeRoles("VENDOR"),
  updateStatus,
);

export default router;