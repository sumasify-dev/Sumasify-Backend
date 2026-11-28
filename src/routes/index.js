import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";
import categoryRoutes from "../modules/categories/category.routes.js";
import productRoutes from "../modules/catalog/product.routes.js";
import cartRoutes from "../modules/carts/cart.routes.js";
import checkoutRoutes from "../modules/checkout/checkout.routes.js";
import adminDashboardRoutes from "../modules/admin/admin.dashboard.routes.js";
import adminVendorApplicationRoutes from "../modules/admin/admin.vendor-applications.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use(categoryRoutes);
router.use(productRoutes);
router.use(cartRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/admin", adminDashboardRoutes);
router.use("/admin/vendor-applications", adminVendorApplicationRoutes);

export default router;
