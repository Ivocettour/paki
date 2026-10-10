import { InventoryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { recordAudit } from "./audit";
import type { BrandInput, DeviceModelInput } from "@/lib/validations/catalog";

function translateUniqueError(error: unknown, message: string): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw errors.conflicto(message);
  }
  throw error;
}

export interface CatalogModel {
  id: string;
  name: string;
  minStock: number;
  deviceCount: number;
  availableCount: number;
  /// Imagen que usa la tienda mientras un equipo no tenga fotos propias.
  imageId: string | null;
  /// Un modelo sin equipos ni compras asociadas todavía puede eliminarse.
  canDelete: boolean;
}

export interface CatalogBrand {
  id: string;
  name: string;
  models: CatalogModel[];
  deviceCount: number;
  canDelete: boolean;
}

/// Catálogo completo con el uso de cada modelo, para poder decidir qué se
/// puede eliminar y qué no.
export async function getCatalogOverview(): Promise<CatalogBrand[]> {
  await requirePermission("configuracion.ver");

  const [brands, devicesByModel, availableByModel, purchaseItemsByModel] =
    await Promise.all([
      prisma.brand.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          models: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, minStock: true, image: { select: { id: true } } },
          },
        },
      }),
      prisma.device.groupBy({ by: ["modelId"], _count: { _all: true } }),
      prisma.device.groupBy({
        by: ["modelId"],
        where: { inventoryStatus: InventoryStatus.DISPONIBLE },
        _count: { _all: true },
      }),
      prisma.purchaseItem.groupBy({
        by: ["modelId"],
        where: { modelId: { not: null } },
        _count: { _all: true },
      }),
    ]);

  const deviceCount = new Map(devicesByModel.map((r) => [r.modelId, r._count._all]));
  const availableCount = new Map(availableByModel.map((r) => [r.modelId, r._count._all]));
  const purchaseCount = new Map(
    purchaseItemsByModel.map((r) => [r.modelId as string, r._count._all]),
  );

  return brands.map((brand) => {
    const models = brand.models.map<CatalogModel>((model) => {
      const devices = deviceCount.get(model.id) ?? 0;
      const purchases = purchaseCount.get(model.id) ?? 0;

      return {
        id: model.id,
        name: model.name,
        minStock: model.minStock,
        deviceCount: devices,
        availableCount: availableCount.get(model.id) ?? 0,
        imageId: model.image?.id ?? null,
        canDelete: devices === 0 && purchases === 0,
      };
    });

    return {
      id: brand.id,
      name: brand.name,
      models,
      deviceCount: models.reduce((sum, model) => sum + model.deviceCount, 0),
      // Una marca se puede borrar solo si no tiene modelos.
      canDelete: models.length === 0,
    };
  });
}

export async function createBrand(input: BrandInput): Promise<{ id: string }> {
  const user = await requirePermission("catalogo.gestionar");

  try {
    return await prisma.$transaction(async (tx) => {
      const brand = await tx.brand.create({
        data: { name: input.name },
        select: { id: true },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "MODIFICAR_CONFIGURACION",
        entity: "Brand",
        entityId: brand.id,
        changes: { marca: { anterior: null, nuevo: input.name } },
      });

      return brand;
    });
  } catch (error) {
    translateUniqueError(error, "Ya existe una marca con ese nombre.");
  }
}

export async function updateBrand(id: string, input: BrandInput): Promise<void> {
  const user = await requirePermission("catalogo.gestionar");

  const current = await prisma.brand.findUnique({
    where: { id },
    select: { name: true },
  });

  if (!current) throw errors.noEncontrado("la marca");
  if (current.name === input.name) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.brand.update({ where: { id }, data: { name: input.name } });

      await recordAudit(tx, {
        userId: user.id,
        action: "MODIFICAR_CONFIGURACION",
        entity: "Brand",
        entityId: id,
        changes: { marca: { anterior: current.name, nuevo: input.name } },
      });
    });
  } catch (error) {
    translateUniqueError(error, "Ya existe una marca con ese nombre.");
  }
}

/**
 * Elimina una marca vacía.
 *
 * Solo se permite cuando no tiene modelos: si los tuviera, borrarla arrastraría
 * historial de equipos y compras. Es la única eliminación física del sistema, y
 * existe para poder corregir una marca cargada por error.
 */
export async function deleteBrand(id: string): Promise<void> {
  const user = await requirePermission("catalogo.gestionar");

  const brand = await prisma.brand.findUnique({
    where: { id },
    select: { name: true, _count: { select: { models: true } } },
  });

  if (!brand) throw errors.noEncontrado("la marca");

  if (brand._count.models > 0) {
    throw errors.regla(
      `No se puede eliminar ${brand.name} porque tiene ${brand._count.models} ${
        brand._count.models === 1 ? "modelo asociado" : "modelos asociados"
      }.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.brand.delete({ where: { id } });

    await recordAudit(tx, {
      userId: user.id,
      action: "MODIFICAR_CONFIGURACION",
      entity: "Brand",
      entityId: id,
      changes: { marcaEliminada: { anterior: brand.name, nuevo: null } },
    });
  });
}

export async function createDeviceModel(input: DeviceModelInput): Promise<{ id: string }> {
  const user = await requirePermission("catalogo.gestionar");

  const brand = await prisma.brand.findUnique({
    where: { id: input.brandId },
    select: { id: true, name: true },
  });

  if (!brand) throw errors.noEncontrado("la marca");

  try {
    return await prisma.$transaction(async (tx) => {
      const model = await tx.deviceModel.create({
        data: { brandId: input.brandId, name: input.name, minStock: input.minStock },
        select: { id: true },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "MODIFICAR_CONFIGURACION",
        entity: "DeviceModel",
        entityId: model.id,
        changes: {
          modelo: { anterior: null, nuevo: `${brand.name} ${input.name}` },
          minStock: { anterior: null, nuevo: input.minStock },
        },
      });

      return model;
    });
  } catch (error) {
    translateUniqueError(error, `Ya existe un modelo con ese nombre en ${brand.name}.`);
  }
}

export async function updateDeviceModel(
  id: string,
  input: DeviceModelInput,
): Promise<void> {
  const user = await requirePermission("catalogo.gestionar");

  const current = await prisma.deviceModel.findUnique({
    where: { id },
    select: { name: true, minStock: true, brandId: true },
  });

  if (!current) throw errors.noEncontrado("el modelo");

  const changes: Record<string, { anterior: unknown; nuevo: unknown }> = {};
  if (current.name !== input.name) {
    changes.modelo = { anterior: current.name, nuevo: input.name };
  }
  if (current.minStock !== input.minStock) {
    changes.minStock = { anterior: current.minStock, nuevo: input.minStock };
  }

  if (Object.keys(changes).length === 0) return;

  try {
    await prisma.$transaction(async (tx) => {
      // La marca no se cambia desde acá: mover un modelo de marca alteraría
      // el historial de todos los equipos que ya lo referencian.
      await tx.deviceModel.update({
        where: { id },
        data: { name: input.name, minStock: input.minStock },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "MODIFICAR_CONFIGURACION",
        entity: "DeviceModel",
        entityId: id,
        changes,
      });
    });
  } catch (error) {
    translateUniqueError(error, "Ya existe un modelo con ese nombre en esa marca.");
  }
}

/// Elimina un modelo sin equipos ni compras asociados.
export async function deleteDeviceModel(id: string): Promise<void> {
  const user = await requirePermission("catalogo.gestionar");

  const model = await prisma.deviceModel.findUnique({
    where: { id },
    select: {
      name: true,
      brand: { select: { name: true } },
      _count: { select: { devices: true, purchaseItems: true } },
    },
  });

  if (!model) throw errors.noEncontrado("el modelo");

  const label = `${model.brand.name} ${model.name}`;

  if (model._count.devices > 0) {
    throw errors.regla(
      `No se puede eliminar ${label} porque tiene ${model._count.devices} ${
        model._count.devices === 1 ? "equipo asociado" : "equipos asociados"
      }. El historial no se borra.`,
    );
  }

  if (model._count.purchaseItems > 0) {
    throw errors.regla(
      `No se puede eliminar ${label} porque aparece en compras registradas.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.deviceModel.delete({ where: { id } });

    await recordAudit(tx, {
      userId: user.id,
      action: "MODIFICAR_CONFIGURACION",
      entity: "DeviceModel",
      entityId: id,
      changes: { modeloEliminado: { anterior: label, nuevo: null } },
    });
  });
}
