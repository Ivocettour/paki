import {
  DeviceCondition,
  InventoryStatus,
  Prisma,
  SaleStatus,
  type PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { errors } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
import { toNullableNumber, toNumber } from "@/lib/serialize";
import { diffFields, recordAudit, type DbClient } from "./audit";
import type {
  CreateDeviceInput,
  DeactivateDeviceInput,
  DeviceFilters,
  UpdateDeviceInput,
} from "@/lib/validations/device";

export interface DeviceListItem {
  id: string;
  brandName: string;
  modelName: string;
  color: string;
  storageGb: number | null;
  condition: DeviceCondition;
  batteryPercent: number | null;
  imei: string | null;
  salePrice: number;
  purchasePrice: number | null;
  inventoryStatus: InventoryStatus;
  entryDate: Date;
}

export interface DeviceListResult {
  items: DeviceListItem[];
  total: number;
  page: number;
  pageCount: number;
  canSeePurchasePrice: boolean;
}

/// Campos cuya modificación queda registrada en auditoría.
const AUDITED_FIELDS = [
  "modelId",
  "color",
  "storageGb",
  "condition",
  "batteryPercent",
  "imei",
  "serialNumber",
  "purchasePrice",
  "salePrice",
  "inventoryStatus",
  "entryDate",
  "notes",
] as const;

function buildWhere(filters: DeviceFilters): Prisma.DeviceWhereInput {
  const where: Prisma.DeviceWhereInput = {};
  const and: Prisma.DeviceWhereInput[] = [];

  if (filters.search) {
    const term = filters.search.trim();
    // La búsqueda cubre IMEI (parcial), número de serie, marca, modelo y color.
    and.push({
      OR: [
        { imei: { contains: term, mode: "insensitive" } },
        { serialNumber: { contains: term, mode: "insensitive" } },
        { color: { contains: term, mode: "insensitive" } },
        { model: { name: { contains: term, mode: "insensitive" } } },
        { model: { brand: { name: { contains: term, mode: "insensitive" } } } },
      ],
    });
  }

  if (filters.brandId) and.push({ model: { brandId: filters.brandId } });
  if (filters.modelId) where.modelId = filters.modelId;
  if (filters.condition) where.condition = filters.condition;
  if (filters.inventoryStatus) where.inventoryStatus = filters.inventoryStatus;
  if (filters.storageGb) where.storageGb = filters.storageGb;

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.salePrice = {
      ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
    };
  }

  if (filters.minBattery !== undefined) {
    where.batteryPercent = { gte: filters.minBattery };
  }

  if (filters.entryDateFrom || filters.entryDateTo) {
    where.entryDate = {
      ...(filters.entryDateFrom ? { gte: filters.entryDateFrom } : {}),
      // El "hasta" incluye el día completo.
      ...(filters.entryDateTo ? { lte: endOfDay(filters.entryDateTo) } : {}),
    };
  }

  if (and.length > 0) where.AND = and;
  return where;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export async function listDevices(filters: DeviceFilters): Promise<DeviceListResult> {
  const user = await requirePermission("inventario.ver");
  const canSeePurchasePrice = can(user.role, "inventario.ver_precio_compra");

  const where = buildWhere(filters);

  const orderBy: Prisma.DeviceOrderByWithRelationInput =
    filters.sortBy === "batteryPercent"
      ? { batteryPercent: { sort: filters.sortDir, nulls: "last" } }
      : { [filters.sortBy]: filters.sortDir };

  const [total, rows] = await Promise.all([
    prisma.device.count({ where }),
    prisma.device.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        color: true,
        storageGb: true,
        condition: true,
        batteryPercent: true,
        imei: true,
        salePrice: true,
        purchasePrice: canSeePurchasePrice,
        inventoryStatus: true,
        entryDate: true,
        model: { select: { name: true, brand: { select: { name: true } } } },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      brandName: row.model.brand.name,
      modelName: row.model.name,
      color: row.color,
      storageGb: row.storageGb,
      condition: row.condition,
      batteryPercent: row.batteryPercent,
      imei: row.imei,
      salePrice: toNumber(row.salePrice),
      purchasePrice: canSeePurchasePrice ? toNullableNumber(row.purchasePrice) : null,
      inventoryStatus: row.inventoryStatus,
      entryDate: row.entryDate,
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    canSeePurchasePrice,
  };
}

export async function getDeviceDetail(id: string) {
  const user = await requirePermission("inventario.ver");
  const canSeePurchasePrice = can(user.role, "inventario.ver_precio_compra");

  const device = await prisma.device.findUnique({
    where: { id },
    select: {
      id: true,
      color: true,
      storageGb: true,
      condition: true,
      batteryPercent: true,
      imei: true,
      serialNumber: true,
      salePrice: true,
      purchasePrice: true,
      inventoryStatus: true,
      entryDate: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      modelId: true,
      model: { select: { name: true, brand: { select: { id: true, name: true } } } },
      createdBy: { select: { firstName: true, lastName: true } },
      updatedBy: { select: { firstName: true, lastName: true } },
      stockMovements: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          reason: true,
          notes: true,
          createdAt: true,
          previousStatus: true,
          newStatus: true,
          user: { select: { firstName: true, lastName: true } },
          sale: { select: { id: true, saleNumber: true } },
        },
      },
      saleItems: {
        orderBy: { sale: { saleDate: "desc" } },
        select: {
          id: true,
          unitPrice: true,
          lineTotal: true,
          sale: {
            select: {
              id: true,
              saleNumber: true,
              saleDate: true,
              status: true,
              seller: { select: { firstName: true, lastName: true } },
              customer: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  if (!device) throw errors.noEncontrado("el equipo");

  // El historial de cambios se reconstruye desde la auditoría.
  const auditEntries = await prisma.auditLog.findMany({
    where: { entity: "Device", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      changes: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });

  return {
    id: device.id,
    brandId: device.model.brand.id,
    brandName: device.model.brand.name,
    modelId: device.modelId,
    modelName: device.model.name,
    color: device.color,
    storageGb: device.storageGb,
    condition: device.condition,
    batteryPercent: device.batteryPercent,
    imei: device.imei,
    serialNumber: device.serialNumber,
    salePrice: toNumber(device.salePrice),
    purchasePrice: canSeePurchasePrice ? toNullableNumber(device.purchasePrice) : null,
    canSeePurchasePrice,
    inventoryStatus: device.inventoryStatus,
    entryDate: device.entryDate,
    notes: device.notes,
    createdAt: device.createdAt,
    updatedAt: device.updatedAt,
    createdByName: `${device.createdBy.firstName} ${device.createdBy.lastName}`,
    updatedByName: device.updatedBy
      ? `${device.updatedBy.firstName} ${device.updatedBy.lastName}`
      : null,
    movements: device.stockMovements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      reason: movement.reason,
      notes: movement.notes,
      createdAt: movement.createdAt,
      previousStatus: movement.previousStatus,
      newStatus: movement.newStatus,
      userName: `${movement.user.firstName} ${movement.user.lastName}`,
      saleId: movement.sale?.id ?? null,
      saleNumber: movement.sale?.saleNumber ?? null,
    })),
    sales: device.saleItems.map((item) => ({
      saleItemId: item.id,
      saleId: item.sale.id,
      saleNumber: item.sale.saleNumber,
      saleDate: item.sale.saleDate,
      saleStatus: item.sale.status,
      unitPrice: toNumber(item.unitPrice),
      lineTotal: toNumber(item.lineTotal),
      sellerName: `${item.sale.seller.firstName} ${item.sale.seller.lastName}`,
      customerName: item.sale.customer
        ? `${item.sale.customer.firstName} ${item.sale.customer.lastName}`
        : null,
    })),
    auditEntries: auditEntries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      changes: entry.changes as Record<string, { anterior: unknown; nuevo: unknown }> | null,
      createdAt: entry.createdAt,
      userName: `${entry.user.firstName} ${entry.user.lastName}`,
    })),
  };
}

export type DeviceDetail = Awaited<ReturnType<typeof getDeviceDetail>>;

/// Traduce la violación de IMEI único a un mensaje del dominio.
function translateUniqueImeiError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("imei")
  ) {
    throw errors.conflicto("El IMEI ingresado ya existe en el inventario.");
  }
  throw error;
}

export async function createDevice(input: CreateDeviceInput): Promise<{ id: string }> {
  const user = await requirePermission("inventario.crear");

  try {
    return await prisma.$transaction(async (tx) => {
      const device = await tx.device.create({
        data: {
          modelId: input.modelId,
          color: input.color,
          storageGb: input.storageGb,
          condition: input.condition,
          batteryPercent: input.batteryPercent ?? null,
          imei: input.imei ?? null,
          serialNumber: input.serialNumber ?? null,
          purchasePrice: input.purchasePrice ?? null,
          salePrice: input.salePrice,
          entryDate: input.entryDate,
          notes: input.notes ?? null,
          createdById: user.id,
        },
        select: { id: true, inventoryStatus: true },
      });

      // Todo equipo que entra al inventario deja su movimiento de INGRESO.
      await tx.stockMovement.create({
        data: {
          deviceId: device.id,
          type: "INGRESO",
          reason: "Alta de equipo en inventario",
          userId: user.id,
          newStatus: device.inventoryStatus,
        },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "CREAR_PRODUCTO",
        entity: "Device",
        entityId: device.id,
        changes: {
          imei: { anterior: null, nuevo: input.imei ?? null },
          salePrice: { anterior: null, nuevo: input.salePrice },
        },
      });

      return { id: device.id };
    });
  } catch (error) {
    translateUniqueImeiError(error);
  }
}

export async function updateDevice(id: string, input: UpdateDeviceInput): Promise<void> {
  const user = await requirePermission("inventario.editar");

  const current = await prisma.device.findUnique({
    where: { id },
    select: {
      id: true,
      modelId: true,
      color: true,
      storageGb: true,
      condition: true,
      batteryPercent: true,
      imei: true,
      serialNumber: true,
      purchasePrice: true,
      salePrice: true,
      inventoryStatus: true,
      entryDate: true,
      notes: true,
    },
  });

  if (!current) throw errors.noEncontrado("el equipo");

  const priceChanged = toNumber(current.salePrice) !== input.salePrice;
  // Cambiar el precio es un permiso aparte de editar el resto de los datos.
  if (priceChanged && !can(user.role, "inventario.editar_precio")) {
    throw errors.sinPermisos("No tenés permisos para modificar el precio.");
  }

  // Un equipo vendido no puede volver a DISPONIBLE editando el formulario:
  // eso se resuelve anulando la venta, que además revierte el stock.
  if (
    current.inventoryStatus === InventoryStatus.VENDIDO &&
    input.inventoryStatus !== InventoryStatus.VENDIDO
  ) {
    const activeSale = await prisma.saleItem.findFirst({
      where: { deviceId: id, sale: { status: SaleStatus.COMPLETADA } },
      select: { sale: { select: { saleNumber: true } } },
    });

    if (activeSale) {
      throw errors.regla(
        `Este equipo está asociado a la venta ${activeSale.sale.saleNumber}. Para devolverlo al inventario, anulá esa venta.`,
      );
    }
  }

  const changes = diffFields(
    {
      ...current,
      purchasePrice: toNullableNumber(current.purchasePrice),
      salePrice: toNumber(current.salePrice),
    },
    {
      modelId: input.modelId,
      color: input.color,
      storageGb: input.storageGb,
      condition: input.condition,
      batteryPercent: input.batteryPercent ?? null,
      imei: input.imei ?? null,
      serialNumber: input.serialNumber ?? null,
      purchasePrice: input.purchasePrice ?? null,
      salePrice: input.salePrice,
      inventoryStatus: input.inventoryStatus,
      entryDate: input.entryDate,
      notes: input.notes ?? null,
    },
    AUDITED_FIELDS,
  );

  if (Object.keys(changes).length === 0) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.device.update({
        where: { id },
        data: {
          modelId: input.modelId,
          color: input.color,
          storageGb: input.storageGb,
          condition: input.condition,
          batteryPercent: input.batteryPercent ?? null,
          imei: input.imei ?? null,
          serialNumber: input.serialNumber ?? null,
          purchasePrice: input.purchasePrice ?? null,
          salePrice: input.salePrice,
          inventoryStatus: input.inventoryStatus,
          entryDate: input.entryDate,
          notes: input.notes ?? null,
          updatedById: user.id,
        },
      });

      // Un cambio de precio se audita por separado para poder rastrearlo.
      if (priceChanged) {
        await recordAudit(tx, {
          userId: user.id,
          action: "MODIFICAR_PRECIO",
          entity: "Device",
          entityId: id,
          changes: {
            salePrice: {
              anterior: toNumber(current.salePrice),
              nuevo: input.salePrice,
            },
          },
        });
      }

      const otherChanges = Object.fromEntries(
        Object.entries(changes).filter(([field]) => field !== "salePrice"),
      );

      if (Object.keys(otherChanges).length > 0) {
        await recordAudit(tx, {
          userId: user.id,
          action: "MODIFICAR_PRODUCTO",
          entity: "Device",
          entityId: id,
          changes: otherChanges,
        });
      }

      // Un cambio manual de estado de inventario también es movimiento de stock.
      if (changes.inventoryStatus) {
        await tx.stockMovement.create({
          data: {
            deviceId: id,
            type: "AJUSTE_POSITIVO",
            reason: "Cambio manual de estado de inventario",
            userId: user.id,
            previousStatus: current.inventoryStatus,
            newStatus: input.inventoryStatus,
          },
        });
      }
    });
  } catch (error) {
    translateUniqueImeiError(error);
  }
}

/// Baja lógica: nunca se elimina físicamente un equipo.
export async function deactivateDevice(
  id: string,
  input: DeactivateDeviceInput,
): Promise<void> {
  const user = await requirePermission("inventario.dar_de_baja");

  const device = await prisma.device.findUnique({
    where: { id },
    select: { id: true, inventoryStatus: true },
  });

  if (!device) throw errors.noEncontrado("el equipo");

  if (device.inventoryStatus === InventoryStatus.INACTIVO) {
    throw errors.regla("Este equipo ya está dado de baja.");
  }

  if (device.inventoryStatus === InventoryStatus.VENDIDO && !input.forceSold) {
    throw errors.regla(
      "Este equipo no puede darse de baja porque tiene una venta asociada. Confirmá la baja administrativa si realmente querés continuar.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.device.update({
      where: { id },
      data: { inventoryStatus: InventoryStatus.INACTIVO, updatedById: user.id },
    });

    await tx.stockMovement.create({
      data: {
        deviceId: id,
        type: "BAJA",
        reason: input.reason,
        userId: user.id,
        previousStatus: device.inventoryStatus,
        newStatus: InventoryStatus.INACTIVO,
      },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "BAJA_PRODUCTO",
      entity: "Device",
      entityId: id,
      changes: {
        inventoryStatus: {
          anterior: device.inventoryStatus,
          nuevo: InventoryStatus.INACTIVO,
        },
        motivo: { anterior: null, nuevo: input.reason },
      },
    });
  });
}

/// Catálogo de marcas y modelos para los formularios y filtros.
export async function getCatalog() {
  await requirePermission("inventario.ver");

  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      models: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, minStock: true },
      },
    },
  });

  return brands;
}

export type Catalog = Awaited<ReturnType<typeof getCatalog>>;

/// Búsqueda acotada a equipos disponibles, para el registro de ventas.
export async function searchAvailableDevices(
  term: string,
  limit = 10,
  db: DbClient | PrismaClient = prisma,
) {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  const rows = await db.device.findMany({
    where: {
      inventoryStatus: InventoryStatus.DISPONIBLE,
      OR: [
        { imei: { contains: trimmed, mode: "insensitive" } },
        { serialNumber: { contains: trimmed, mode: "insensitive" } },
        { model: { name: { contains: trimmed, mode: "insensitive" } } },
        { model: { brand: { name: { contains: trimmed, mode: "insensitive" } } } },
      ],
    },
    take: limit,
    orderBy: { entryDate: "desc" },
    select: {
      id: true,
      imei: true,
      color: true,
      storageGb: true,
      condition: true,
      batteryPercent: true,
      salePrice: true,
      model: { select: { name: true, brand: { select: { name: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    imei: row.imei,
    color: row.color,
    storageGb: row.storageGb,
    condition: row.condition,
    batteryPercent: row.batteryPercent,
    salePrice: toNumber(row.salePrice),
    brandName: row.model.brand.name,
    modelName: row.model.name,
  }));
}
