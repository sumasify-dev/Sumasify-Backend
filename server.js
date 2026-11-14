import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

import app from "./app.js";
import { env } from "./src/config/env.js";
import prisma from "./src/config/prisma.js";
import { startPaymentExpiryWorker } from "./src/modules/checkout/checkout.expiry.js";

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    startPaymentExpiryWorker();

    app.listen(env.port, () => {
      console.log(`SUMASIFY backend running on port ${env.port}`);
    });
  } catch (err) {
    console.error("Failed to start SUMASIFY backend:", err);
    process.exit(1);
  }
}

start();
