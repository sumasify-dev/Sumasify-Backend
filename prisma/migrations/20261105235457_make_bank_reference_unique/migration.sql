/*
  Warnings:

  - A unique constraint covering the columns `[bank_reference]` on the table `payments` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "payments_bank_reference_key" ON "payments"("bank_reference");
