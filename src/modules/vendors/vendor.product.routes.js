import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import {
  list,
  create,
  update,
  inventory,
} from "./vendor.product.controller.js";

const router = Router();

router.get(
  "/vendor/products",
  authenticate,
  authorizeRoles("VENDOR"),
  list,
);

router.post(
  "/vendor/products",
  authenticate,
  authorizeRoles("VENDOR"),
  create,
);

router.patch(
  "/vendor/products/:productid",
  authenticate,
  authorizeRoles("VENDOR"),
  update,
);

router.patch(
  "/vendor/products/:productid/inventory",
  authenticate,
  authorizeRoles("VENDOR"),
  inventory,
);

export default router;