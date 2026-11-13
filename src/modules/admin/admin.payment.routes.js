import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import { decide } from "./admin.payment.controller.js";

const router = Router();

router.patch(
  "/admin/payments/:paymentid",
  authenticate,
  authorizeRoles("ADMIN"),
  decide,
);

export default router;