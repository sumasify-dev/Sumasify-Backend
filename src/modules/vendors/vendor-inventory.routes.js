import { Router } from "express";
import {updateVendorProductInventoryController} from "./vendor-inventory.controller.js";
import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";

const router = Router();


router.patch("/vendor/products/:productid/inventory",authenticate,authorizeRoles("VENDOR"),updateVendorProductInventoryController,);
export default router;