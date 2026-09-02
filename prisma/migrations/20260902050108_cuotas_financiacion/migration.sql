-- CreateEnum
CREATE TYPE "FinancingType" AS ENUM ('CONTADO', 'TARJETA', 'FINANCIACION_LOCAL');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDIENTE', 'PAGADA', 'ANULADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'REGISTRAR_PAGO_CUOTA';
ALTER TYPE "AuditAction" ADD VALUE 'ANULAR_PAGO_CUOTA';

-- NOTA: se elimina a propósito el `DROP INDEX "devices_imei_trgm_idx"` que
-- genera Prisma. Ese índice GIN/trigram se creó en una migración manual y
-- Prisma no lo representa en el schema, por lo que intenta descartarlo en cada
-- migración siguiente. Sostiene la búsqueda parcial por IMEI y debe conservarse.

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "financingType" "FinancingType" NOT NULL DEFAULT 'CONTADO',
ADD COLUMN     "installmentCount" INTEGER;

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(12,2),
    "paymentMethod" "PaymentMethod",
    "notes" TEXT,
    "registeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installments_dueDate_idx" ON "installments"("dueDate");

-- CreateIndex
CREATE INDEX "installments_status_idx" ON "installments"("status");

-- CreateIndex
CREATE INDEX "installments_status_dueDate_idx" ON "installments"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "installments_saleId_number_key" ON "installments"("saleId", "number");

-- CreateIndex
CREATE INDEX "sales_financingType_idx" ON "sales"("financingType");

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas de negocio de cuotas garantizadas por la base de datos.

-- Importes positivos y numeración válida.
ALTER TABLE "installments"
  ADD CONSTRAINT "installments_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "installments"
  ADD CONSTRAINT "installments_number_positive" CHECK ("number" > 0);

ALTER TABLE "installments"
  ADD CONSTRAINT "installments_paid_amount_non_negative"
  CHECK ("paidAmount" IS NULL OR "paidAmount" >= 0);

-- Una cuota PAGADA debe registrar cuándo se cobró, cuánto y quién lo registró.
ALTER TABLE "installments"
  ADD CONSTRAINT "installments_paid_metadata"
  CHECK (
    "status" <> 'PAGADA'
    OR ("paidAt" IS NOT NULL AND "paidAmount" IS NOT NULL AND "registeredById" IS NOT NULL)
  );

-- Una cuota que no está PAGADA no puede conservar datos de cobro.
ALTER TABLE "installments"
  ADD CONSTRAINT "installments_unpaid_has_no_payment"
  CHECK ("status" = 'PAGADA' OR ("paidAt" IS NULL AND "paidAmount" IS NULL));

-- Solo las ventas con financiación propia del local generan cuotas.
-- Las ventas en cuotas con tarjeta las liquida el banco: no son deuda del cliente.
ALTER TABLE "sales"
  ADD CONSTRAINT "sales_installment_count_coherent"
  CHECK (
    ("financingType" = 'CONTADO' AND "installmentCount" IS NULL)
    OR ("financingType" <> 'CONTADO' AND "installmentCount" IS NOT NULL AND "installmentCount" > 0)
  );
