import { Router } from "express";

import { authenticate } from "../../middleware/utils/authenticate.js";
import { authorizeRoles } from "../../middleware/utils/authorize.js";

import { getCart, updateCartItem, deleteCartItem } from "./cart.controller.js";

const router = Router();

// Buyer cart
router.get("/cart", authenticate, authorizeRoles("BUYER"), getCart);

router.put(
  "/cart/items/:productId",
  authenticate,
  authorizeRoles("BUYER"),
  updateCartItem,
);

router.delete(
  "/cart/items/:productId",
  authenticate,
  authorizeRoles("BUYER"),
  deleteCartItem,
);

export default router;
