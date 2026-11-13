import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";
import categoryRoutes from "../modules/categories/category.routes.js";
import productRoutes from "../modules/catalog/product.routes.js";
import cartRoutes from "../modules/carts/cart.routes.js";
import orderRoutes from "../modules/orders/order.routes.js";
import paymentRoutes from "../modules/payments/payment.routes.js";
import checkoutRoutes from "../modules/checkout/checkout.routes.js";
import addressRoutes from "../modules/addresses/address.routes.js";
import adminPaymentRoutes from "../modules/admin/admin.payment.routes.js";
import vendorApplicationRoutes from "../modules/vendors/vendor.application.routes.js";
import vendorProfileRoutes from "../modules/vendors/vendor.profile.routes.js";
import vendorProductRoutes from "../modules/vendors/vendor.product.routes.js";
import vendorOrderRoutes from "../modules/vendors/vendor.order.routes.js";
import imageRoutes from "../modules/uploads/image.routes.js";
import adminVendorApplicationRoutes from "../modules/admin/admin.vendor.application.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use(categoryRoutes);
router.use(productRoutes);
router.use(cartRoutes);
router.use(orderRoutes);
router.use(paymentRoutes);
router.use(checkoutRoutes);
router.use(addressRoutes);
router.use(adminPaymentRoutes);
router.use(vendorApplicationRoutes);
router.use(vendorProfileRoutes);
router.use(vendorProductRoutes);
router.use(vendorOrderRoutes);
router.use(imageRoutes);
router.use(adminVendorApplicationRoutes);

export default router;
