import { Router } from "express";
import {getVendorProductsController,createVendorProductController,updateVendorProductController} from "./vendor-product.controller.js";
import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";

const router = Router();

router.get("/vendor/products",authenticate,authorizeRoles("VENDOR"),getVendorProductsController);
router.post("/vendor/products",authenticate,authorizeRoles("VENDOR"),createVendorProductController);
router.patch("/vendor/products/:productid",authenticate,authorizeRoles("VENDOR"),updateVendorProductController);
export default router;