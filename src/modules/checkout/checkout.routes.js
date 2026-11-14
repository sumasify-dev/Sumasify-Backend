import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { preview, createOrder } from "./checkout.controller.js";

const router = Router();

router.use(authenticate);

router.post("/preview", preview);
router.post("/orders", createOrder);

export default router;
