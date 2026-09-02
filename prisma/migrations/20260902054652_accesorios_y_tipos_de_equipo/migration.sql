-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('CELULAR', 'TABLET', 'RELOJ', 'PARLANTE', 'CAMARA', 'OTRO');

-- CreateEnum
CREATE TYPE "AccessoryCategory" AS ENUM ('FUNDA', 'TEMPLADO', 'PROTECTOR', 'CARGADOR', 'CABLE', 'AURICULARES', 'SOPORTE', 'BATERIA_EXTERNA', 'OTRO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREAR_ACCESORIO';
ALTER TYPE "AuditAction" ADD VALUE 'MODIFICAR_ACCESORIO';
ALTER TYPE "AuditAction" ADD VALUE 'BAJA_ACCESORIO';

-- NOTA: se elimina a propósito el `DROP INDEX "devices_imei_trgm_idx"` que
-- genera Prisma. Ese índice GIN/trigram se creó en una migración manual y
-- Prisma no lo representa en el schema, por lo que intenta descartarlo en cada
-- migración. Sostiene la búsqueda parcial por IMEI y debe conservarse.

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "type" "DeviceType" NOT NULL DEFAULT 'CELULAR',
ALTER COLUMN "storageGb" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN     "accessoryId" TEXT,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "deviceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "accessoryId" TEXT,
ADD COLUMN     "quantityAfter" INTEGER,
ADD COLUMN     "quantityDelta" INTEGER,
ALTER COLUMN "deviceId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "accessories" (
    "id" TEXT NOT NULL,
    "category" "AccessoryCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "sku" TEXT,
    "salePrice" DECIMAL(12,2) NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accessories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accessories_sku_key" ON "accessories"("sku");

-- CreateIndex
CREATE INDEX "accessories_category_idx" ON "accessories"("category");

-- CreateIndex
CREATE INDEX "accessories_isActive_idx" ON "accessories"("isActive");

-- CreateIndex
CREATE INDEX "accessories_name_idx" ON "accessories"("name");

-- CreateIndex
CREATE INDEX "devices_type_idx" ON "devices"("type");

-- CreateIndex
CREATE INDEX "devices_type_inventoryStatus_idx" ON "devices"("type", "inventoryStatus");

-- CreateIndex
CREATE INDEX "sale_items_accessoryId_idx" ON "sale_items"("accessoryId");

-- CreateIndex
CREATE INDEX "stock_movements_accessoryId_idx" ON "stock_movements"("accessoryId");

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "accessories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accessories" ADD CONSTRAINT "accessories_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "accessories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Reglas de negocio del nuevo modelo, garantizadas por la base de datos.
-- ---------------------------------------------------------------------------

-- El CHECK de batería obligatoria pasa a aplicar solo a los equipos que
-- realmente reportan salud de batería. Un parlante usado no la declara.
ALTER TABLE "devices" DROP CONSTRAINT "devices_used_requires_battery";

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_used_requires_battery"
  CHECK (
    "condition" <> 'USADO'
    OR "type" NOT IN ('CELULAR', 'TABLET', 'RELOJ')
    OR "batteryPercent" IS NOT NULL
  );

-- La capacidad ahora puede ser nula (un parlante no tiene almacenamiento),
-- pero si está presente sigue teniendo que ser positiva.
ALTER TABLE "devices" DROP CONSTRAINT "devices_storage_positive";

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_storage_positive"
  CHECK ("storageGb" IS NULL OR "storageGb" > 0);

-- Accesorios: importes y cantidades coherentes.
ALTER TABLE "accessories"
  ADD CONSTRAINT "accessories_sale_price_non_negative" CHECK ("salePrice" >= 0);

-- El stock nunca puede quedar negativo: es la garantía final contra vender
-- más unidades de las que hay, incluso con ventas simultáneas.
ALTER TABLE "accessories"
  ADD CONSTRAINT "accessories_stock_non_negative" CHECK ("stockQuantity" >= 0);

ALTER TABLE "accessories"
  ADD CONSTRAINT "accessories_min_stock_non_negative" CHECK ("minStock" >= 0);

-- Una línea de venta refiere a un equipo O a un accesorio, nunca a ambos ni a
-- ninguno.
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_exactly_one_target"
  CHECK (num_nonnulls("deviceId", "accessoryId") = 1);

-- Un equipo individual se vende de a uno; un accesorio, al menos uno.
ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_quantity_coherent"
  CHECK (
    ("deviceId" IS NOT NULL AND "quantity" = 1)
    OR ("accessoryId" IS NOT NULL AND "quantity" >= 1)
  );

-- Lo mismo para los movimientos de stock.
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_exactly_one_target"
  CHECK (num_nonnulls("deviceId", "accessoryId") = 1);

-- Un movimiento de accesorio registra la variación; uno de equipo, no.
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_quantity_coherent"
  CHECK (
    ("accessoryId" IS NOT NULL AND "quantityDelta" IS NOT NULL AND "quantityDelta" <> 0)
    OR ("deviceId" IS NOT NULL AND "quantityDelta" IS NULL)
  );

-- Búsqueda parcial de accesorios por nombre.
CREATE INDEX "accessories_name_trgm_idx" ON "accessories" USING gin ("name" gin_trgm_ops);
