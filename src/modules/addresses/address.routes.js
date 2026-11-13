import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import {
  listAddresses,
  createAddress,
} from "./address.controller.js";

const router = Router();

router.get(
  "/addresses",
  authenticate,
  authorizeRoles("BUYER"),
  listAddresses,
);

router.post(
  "/addresses",
  authenticate,
  authorizeRoles("BUYER"),
  createAddress,
);

export default router;