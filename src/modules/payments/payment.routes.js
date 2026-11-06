import { Router } from "express";
import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";
import { submitBankTransferPayment } from "./payment.controller.js";

const router = Router();

router.post("/orders/:orderid/payments/bank-transfer",authenticate,authorizeRoles("BUYER"),submitBankTransferPayment);
export default router;