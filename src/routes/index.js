import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";
import categoryRoutes from "../modules/categories/category.routes.js";
import productRoutes from "../modules/catalog/product.routes.js";
import cartRoutes from "../modules/carts/cart.routes.js";
import checkoutRoutes from "../modules/checkout/checkout.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use(categoryRoutes);
router.use(productRoutes);
router.use(cartRoutes);
router.use("/checkout", checkoutRoutes);

export default router;
