-- CreateTable
CREATE TABLE "product_image_uploads" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER NOT NULL,
    "attached_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_image_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_image_uploads_storage_key_key" ON "product_image_uploads"("storage_key");

-- CreateIndex
CREATE INDEX "product_image_uploads_vendor_id_attached_at_created_at_idx" ON "product_image_uploads"("vendor_id", "attached_at", "created_at");

-- AddForeignKey
ALTER TABLE "product_image_uploads" ADD CONSTRAINT "product_image_uploads_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;