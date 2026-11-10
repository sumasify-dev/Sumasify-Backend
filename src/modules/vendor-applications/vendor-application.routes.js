import { Router } from "express";
import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import {createApplication,getMyApplication} from "./vendor-application.controller.js";

const router = Router();

router.post( "/vendor-applications",authenticate,authorizeRoles("BUYER"),createApplication);
router.get("/vendor-applications/me",authenticate,authorizeRoles("BUYER"),getMyApplication);
export default router;