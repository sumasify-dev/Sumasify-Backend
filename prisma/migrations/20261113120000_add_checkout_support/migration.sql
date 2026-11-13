-- CreateTable
CREATE TABLE "checkout_idempotency" (
    "id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkout_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_number_counters" (
    "date_key" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_number_counters_pkey" PRIMARY KEY ("date_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "checkout_idempotency_idempotency_key_key" ON "checkout_idempotency"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "checkout_idempotency_order_id_key" ON "checkout_idempotency"("order_id");

-- CreateIndex
CREATE INDEX "checkout_idempotency_buyer_id_created_at_idx" ON "checkout_idempotency"("buyer_id", "created_at");

-- AddForeignKey
ALTER TABLE "checkout_idempotency" ADD CONSTRAINT "checkout_idempotency_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkout_idempotency" ADD CONSTRAINT "checkout_idempotency_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;