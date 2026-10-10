-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "useModelImage" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "device_photos" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_images" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "device_photos_deviceId_position_idx" ON "device_photos"("deviceId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "model_images_modelId_key" ON "model_images"("modelId");

-- AddForeignKey
ALTER TABLE "device_photos" ADD CONSTRAINT "device_photos_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_images" ADD CONSTRAINT "model_images_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "device_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tamaño razonable por imagen (el navegador las reduce; esto es la última barrera).
ALTER TABLE "device_photos"
  ADD CONSTRAINT "device_photos_size_range"
  CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 5242880);

ALTER TABLE "model_images"
  ADD CONSTRAINT "model_images_size_range"
  CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 5242880);
