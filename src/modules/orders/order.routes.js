import { Router } from "express";
import {authenticate} from "../../middleware/utils/authenticate.js";
import {authorizeRoles,} from "../../middleware/utils/authorize.js";
import {listOrders,getOrder} from "./order.controller.js";

const router = Router();

router.get("/orders",authenticate,authorizeRoles("BUYER"),listOrders);
router.get("/orders/:orderid",authenticate,authorizeRoles("BUYER", "ADMIN"),getOrder);
export default router;
