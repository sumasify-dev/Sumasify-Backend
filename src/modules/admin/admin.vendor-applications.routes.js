import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";

import {
  getVendorApplications,
  reviewApplication,
} from "./admin.vendor-applications.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", getVendorApplications);
router.patch("/:id", reviewApplication);

export default router;
