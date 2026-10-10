-- AlterTable: recargo (interés) por financiación en cada venta.
ALTER TABLE "sales" ADD COLUMN     "surchargeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "surchargePercent" DECIMAL(6,2) NOT NULL DEFAULT 0;

-- CreateTable: planes de financiación sugeridos (recargo por cantidad de cuotas).
CREATE TABLE "financing_plans" (
    "id" TEXT NOT NULL,
    "type" "FinancingType" NOT NULL,
    "installments" INTEGER NOT NULL,
    "surchargePercent" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financing_plans_isActive_idx" ON "financing_plans"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "financing_plans_type_installments_key" ON "financing_plans"("type", "installments");

-- Reglas garantizadas por la base.
ALTER TABLE "financing_plans"
  ADD CONSTRAINT "financing_plans_type_financed"
  CHECK ("type" <> 'CONTADO');

ALTER TABLE "financing_plans"
  ADD CONSTRAINT "financing_plans_installments_range"
  CHECK ("installments" >= 1 AND "installments" <= 60);

ALTER TABLE "financing_plans"
  ADD CONSTRAINT "financing_plans_surcharge_range"
  CHECK ("surchargePercent" >= 0 AND "surchargePercent" <= 300);

ALTER TABLE "sales"
  ADD CONSTRAINT "sales_surcharge_non_negative"
  CHECK ("surchargePercent" >= 0 AND "surchargeAmount" >= 0);
