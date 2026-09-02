-- Reglas de negocio garantizadas por la base de datos.
-- No dependen del código de aplicación: cualquier acceso directo también las respeta.

-- Batería entre 0 y 100.
ALTER TABLE "devices"
  ADD CONSTRAINT "devices_battery_percent_range"
  CHECK ("batteryPercent" IS NULL OR ("batteryPercent" >= 0 AND "batteryPercent" <= 100));

-- Los equipos usados deben declarar porcentaje de batería.
ALTER TABLE "devices"
  ADD CONSTRAINT "devices_used_requires_battery"
  CHECK ("condition" <> 'USADO' OR "batteryPercent" IS NOT NULL);

-- Precios no negativos y capacidad positiva.
ALTER TABLE "devices"
  ADD CONSTRAINT "devices_sale_price_non_negative" CHECK ("salePrice" >= 0);

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_purchase_price_non_negative"
  CHECK ("purchasePrice" IS NULL OR "purchasePrice" >= 0);

ALTER TABLE "devices"
  ADD CONSTRAINT "devices_storage_positive" CHECK ("storageGb" > 0);

-- Importes de venta coherentes.
ALTER TABLE "sales"
  ADD CONSTRAINT "sales_amounts_non_negative"
  CHECK ("subtotal" >= 0 AND "discount" >= 0 AND "total" >= 0);

ALTER TABLE "sale_items"
  ADD CONSTRAINT "sale_items_amounts_non_negative"
  CHECK ("unitPrice" >= 0 AND "discount" >= 0 AND "lineTotal" >= 0);

-- Una venta anulada debe registrar responsable, fecha y motivo.
ALTER TABLE "sales"
  ADD CONSTRAINT "sales_cancellation_metadata"
  CHECK (
    "status" <> 'ANULADA'
    OR ("cancelledAt" IS NOT NULL AND "cancelledById" IS NOT NULL AND "cancellationReason" IS NOT NULL)
  );

-- Stock mínimo no negativo.
ALTER TABLE "device_models"
  ADD CONSTRAINT "device_models_min_stock_non_negative" CHECK ("minStock" >= 0);

-- Costos de compra no negativos.
ALTER TABLE "purchase_items"
  ADD CONSTRAINT "purchase_items_costs_non_negative"
  CHECK ("unitCost" >= 0 AND "salePrice" >= 0);

ALTER TABLE "purchases"
  ADD CONSTRAINT "purchases_total_non_negative" CHECK ("total" >= 0);

-- Búsqueda por IMEI parcial y por número de serie (patrón LIKE '%...%').
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "devices_imei_trgm_idx" ON "devices" USING gin ("imei" gin_trgm_ops);
