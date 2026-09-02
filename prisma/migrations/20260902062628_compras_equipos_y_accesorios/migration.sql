-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ANULAR_COMPRA';
ALTER TYPE "AuditAction" ADD VALUE 'CREAR_PROVEEDOR';
ALTER TYPE "AuditAction" ADD VALUE 'MODIFICAR_PROVEEDOR';

-- AlterTable
ALTER TABLE "purchase_items" ADD COLUMN     "accessoryId" TEXT,
ADD COLUMN     "deviceType" "DeviceType",
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "modelId" DROP NOT NULL,
ALTER COLUMN "color" DROP NOT NULL,
ALTER COLUMN "storageGb" DROP NOT NULL,
ALTER COLUMN "condition" DROP NOT NULL,
ALTER COLUMN "salePrice" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "purchase_items_accessoryId_idx" ON "purchase_items"("accessoryId");

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Reglas de negocio de las compras, garantizadas por la base de datos.
-- ---------------------------------------------------------------------------

-- El CHECK anterior asumía que solo los equipos tenían costo por unidad.
ALTER TABLE "purchase_items" DROP CONSTRAINT "purchase_items_costs_non_negative";

ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_costs_non_negative"
  CHECK ("unitCost" >= 0 AND ("salePrice" IS NULL OR "salePrice" >= 0));

-- Un ítem ingresa un equipo O repone un accesorio, nunca las dos cosas.
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_exactly_one_target"
  CHECK (num_nonnulls("modelId", "accessoryId") = 1);

-- Un equipo entra de a uno; de un accesorio se compran una o más unidades.
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_quantity_coherent"
  CHECK (
    ("modelId" IS NOT NULL AND "quantity" = 1)
    OR ("accessoryId" IS NOT NULL AND "quantity" >= 1)
  );

-- Un ítem de equipo necesita los datos mínimos para poder crearlo al confirmar.
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_device_fields"
  CHECK (
    "modelId" IS NULL
    OR ("color" IS NOT NULL AND "condition" IS NOT NULL AND "salePrice" IS NOT NULL)
  );

-- Solo un ítem de equipo puede quedar enlazado a un Device.
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_device_link"
  CHECK ("deviceId" IS NULL OR "modelId" IS NOT NULL);

-- Una compra confirmada debe registrar cuándo se confirmó.
ALTER TABLE "purchases"
  ADD CONSTRAINT "purchases_confirmed_metadata"
  CHECK ("status" <> 'CONFIRMADA' OR "confirmedAt" IS NOT NULL);
