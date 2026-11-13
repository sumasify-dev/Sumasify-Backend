import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import { submit, getMine } from "./vendor.application.controller.js";

const router = Router();

router.post(
  "/vendor-applications",
  authenticate,
  authorizeRoles("BUYER"),
  submit,
);

router.get(
  "/vendor-applications/me",
  authenticate,
  authorizeRoles("BUYER"),
  getMine,
);

export default router;