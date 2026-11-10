import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import categoryRoutes from "../modules/categories/category.routes.js";
import productRoutes from "../modules/catalog/product.routes.js";
import cartRoutes from "../modules/carts/cart.routes.js";
import orderRoutes from "../modules/orders/order.routes.js";
import paymentRoutes from "../modules/payments/payment.routes.js";
import vendorApplicationRoutes from "../modules/vendor-applications/vendor-application.routes.js";
import vendorProfileRoutes from "../modules/vendors/vendor-profile.routes.js";
import vendorProductRoutes from "../modules/vendors/vendor-product.routes.js";
import vendorInventoryRoutes from "../modules/vendors/vendor-inventory.routes.js";


const router = Router();

router.use("/auth", authRoutes);
router.use(categoryRoutes);
router.use(productRoutes);
router.use(cartRoutes);
router.use(orderRoutes);
router.use(paymentRoutes);
router.use(vendorApplicationRoutes);
router.use(vendorProfileRoutes);
router.use(vendorProductRoutes);
router.use(vendorInventoryRoutes);

export default router;
