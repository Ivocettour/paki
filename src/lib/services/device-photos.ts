import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import {
  MAX_PHOTOS_PER_DEVICE,
  MAX_PHOTO_BYTES,
  detectImageType,
} from "@/lib/domain/images";
import { recordAudit } from "./audit";

/// Fotos de un equipo (ids en orden: la primera es la principal) y la imagen de
/// su modelo, si la tiene. Nunca trae los bytes: la imagen se pide aparte.
export async function listDevicePhotos(deviceId: string) {
  await requirePermission("inventario.ver");

  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: {
      useModelImage: true,
      model: { select: { image: { select: { id: true } } } },
      photos: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        select: { id: true, sizeBytes: true },
      },
    },
  });
  if (!device) throw errors.noEncontrado("el equipo");

  return {
    photos: device.photos,
    modelImageId: device.model.image?.id ?? null,
    useModelImage: device.useModelImage,
  };
}

export async function addDevicePhoto(deviceId: string, bytes: Uint8Array): Promise<{ id: string }> {
  const user = await requirePermission("inventario.editar");

  if (bytes.length === 0) throw errors.validacion("La imagen está vacía.");
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw errors.validacion("La foto es demasiado pesada (máximo 3 MB).");
  }

  // Se mira el contenido real: un archivo renombrado como .jpg no pasa.
  const contentType = detectImageType(bytes);
  if (!contentType) throw errors.validacion("Subí una imagen JPG, PNG o WebP.");

  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { id: true } });
  if (!device) throw errors.noEncontrado("el equipo");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.devicePhoto.aggregate({
      where: { deviceId },
      _count: { _all: true },
      _max: { position: true },
    });

    if (existing._count._all >= MAX_PHOTOS_PER_DEVICE) {
      throw errors.regla(`Cada equipo admite hasta ${MAX_PHOTOS_PER_DEVICE} fotos.`);
    }

    const photo = await tx.devicePhoto.create({
      data: {
        deviceId,
        data: Buffer.from(bytes),
        contentType,
        sizeBytes: bytes.length,
        position: (existing._max.position ?? -1) + 1,
      },
      select: { id: true },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "MODIFICAR_PRODUCTO",
      entity: "Device",
      entityId: deviceId,
      changes: { fotos: { anterior: existing._count._all, nuevo: existing._count._all + 1 } },
    });

    return photo;
  });
}

export async function deleteDevicePhoto(photoId: string): Promise<{ deviceId: string }> {
  const user = await requirePermission("inventario.editar");

  const photo = await prisma.devicePhoto.findUnique({
    where: { id: photoId },
    select: { id: true, deviceId: true },
  });
  if (!photo) throw errors.noEncontrado("la foto");

  await prisma.$transaction(async (tx) => {
    const before = await tx.devicePhoto.count({ where: { deviceId: photo.deviceId } });
    await tx.devicePhoto.delete({ where: { id: photoId } });
    await recordAudit(tx, {
      userId: user.id,
      action: "MODIFICAR_PRODUCTO",
      entity: "Device",
      entityId: photo.deviceId,
      changes: { fotos: { anterior: before, nuevo: before - 1 } },
    });
  });

  return { deviceId: photo.deviceId };
}

/// La foto elegida pasa a ser la primera (la que se ve en las tarjetas de la tienda).
export async function setMainDevicePhoto(photoId: string): Promise<{ deviceId: string }> {
  await requirePermission("inventario.editar");

  const photo = await prisma.devicePhoto.findUnique({
    where: { id: photoId },
    select: { id: true, deviceId: true },
  });
  if (!photo) throw errors.noEncontrado("la foto");

  const lowest = await prisma.devicePhoto.aggregate({
    where: { deviceId: photo.deviceId },
    _min: { position: true },
  });

  await prisma.devicePhoto.update({
    where: { id: photoId },
    data: { position: (lowest._min.position ?? 0) - 1 },
  });

  return { deviceId: photo.deviceId };
}

/// Elige si, sin fotos propias, la tienda muestra la imagen del modelo o el dibujo.
export async function setUseModelImage(deviceId: string, value: boolean): Promise<void> {
  await requirePermission("inventario.editar");

  const result = await prisma.device.updateMany({ where: { id: deviceId }, data: { useModelImage: value } });
  if (result.count === 0) throw errors.noEncontrado("el equipo");
}

// ---------------------------------------------------------------------------
// Imagen del modelo
// ---------------------------------------------------------------------------

/// Sube (o reemplaza) la imagen de un modelo. Al reemplazarla se crea otra fila
/// con otro id: la anterior deja de usarse y la nueva se cachea desde cero.
export async function setModelImage(modelId: string, bytes: Uint8Array): Promise<{ id: string }> {
  const user = await requirePermission("catalogo.gestionar");

  if (bytes.length === 0) throw errors.validacion("La imagen está vacía.");
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw errors.validacion("La imagen es demasiado pesada (máximo 3 MB).");
  }
  const contentType = detectImageType(bytes);
  if (!contentType) throw errors.validacion("Subí una imagen JPG, PNG o WebP.");

  const model = await prisma.deviceModel.findUnique({
    where: { id: modelId },
    select: { id: true, name: true, brand: { select: { name: true } } },
  });
  if (!model) throw errors.noEncontrado("el modelo");

  return prisma.$transaction(async (tx) => {
    const had = await tx.modelImage.findUnique({ where: { modelId }, select: { id: true } });
    if (had) await tx.modelImage.delete({ where: { modelId } });

    const image = await tx.modelImage.create({
      data: { modelId, data: Buffer.from(bytes), contentType, sizeBytes: bytes.length },
      select: { id: true },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "MODIFICAR_CONFIGURACION",
      entity: "DeviceModel",
      entityId: modelId,
      changes: {
        imagen: { anterior: had ? "cargada" : null, nuevo: `${model.brand.name} ${model.name}` },
      },
    });
    return image;
  });
}

export async function deleteModelImage(modelId: string): Promise<void> {
  const user = await requirePermission("catalogo.gestionar");

  const image = await prisma.modelImage.findUnique({ where: { modelId }, select: { id: true } });
  if (!image) throw errors.noEncontrado("la imagen del modelo");

  await prisma.$transaction(async (tx) => {
    await tx.modelImage.delete({ where: { modelId } });
    await recordAudit(tx, {
      userId: user.id,
      action: "MODIFICAR_CONFIGURACION",
      entity: "DeviceModel",
      entityId: modelId,
      changes: { imagen: { anterior: "cargada", nuevo: null } },
    });
  });
}
