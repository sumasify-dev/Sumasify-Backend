import { Router } from "express";
import {getMyVendorProfile,updateMyVendorProfile} from "./vendor-profile.controller.js";
import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";

const router = Router();

router.get("/vendor/profile",authenticate,authorizeRoles("VENDOR"),getMyVendorProfile);
router.patch("/vendor/profile",authenticate,authorizeRoles("VENDOR"),updateMyVendorProfile);

export default router;