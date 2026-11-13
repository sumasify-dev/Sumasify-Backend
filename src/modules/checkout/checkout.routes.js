import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import { preview, create } from "./checkout.controller.js";

const router = Router();

router.post(
  "/checkout/preview",
  authenticate,
  authorizeRoles("BUYER"),
  preview,
);

router.post(
  "/checkout/orders",
  authenticate,
  authorizeRoles("BUYER"),
  create,
);

export default router;