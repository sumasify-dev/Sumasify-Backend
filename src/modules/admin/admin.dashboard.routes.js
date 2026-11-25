import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { getDashboard } from "./admin.dashboard.controller.js";

const router = Router();

router.use(authenticate);

router.get("/dashboard", getDashboard);

export default router;
