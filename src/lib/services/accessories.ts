import { AccessoryCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
import { toNumber } from "@/lib/serialize";
import { diffFields, recordAudit } from "./audit";
import type {
  AccessoryFilters,
  AccessoryInput,
  CreateAccessoryInput,
  StockAdjustmentInput,
} from "@/lib/validations/accessory";

const AUDITED_FIELDS = [
  "category",
  "name",
  "brand",
  "sku",
  "salePrice",
  "minStock",
  "notes",
] as const;

function translateUniqueSkuError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("sku")
  ) {
    throw errors.conflicto("Ya existe un accesorio con ese código interno.");
  }
  throw error;
}

export interface AccessoryListItem {
  id: string;
  category: AccessoryCategory;
  name: string;
  brand: string | null;
  sku: string | null;
  salePrice: number;
  stockQuantity: number;
  minStock: number;
  isActive: boolean;
  isLowStock: boolean;
}

export async function listAccessories(filters: AccessoryFilters) {
  await requirePermission("inventario.ver");

  const where: Prisma.AccessoryWhereInput = {
    // Los inactivos quedan fuera salvo pedido explícito: no se eliminan nunca.
    ...(filters.includeInactive ? {} : { isActive: true }),
    ...(filters.category ? { category: filters.category } : {}),
  };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { brand: { contains: filters.search, mode: "insensitive" } },
      { sku: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.accessory.count({ where }),
    prisma.accessory.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        category: true,
        name: true,
        brand: true,
        sku: true,
        salePrice: true,
        stockQuantity: true,
        minStock: true,
        isActive: true,
      },
    }),
  ]);

  const items = rows.map<AccessoryListItem>((accessory) => ({
    id: accessory.id,
    category: accessory.category,
    name: accessory.name,
    brand: accessory.brand,
    sku: accessory.sku,
    salePrice: toNumber(accessory.salePrice),
    stockQuantity: accessory.stockQuantity,
    minStock: accessory.minStock,
    isActive: accessory.isActive,
    // El stock mínimo en 0 significa "sin alerta configurada".
    isLowStock: accessory.minStock > 0 && accessory.stockQuantity < accessory.minStock,
  }));

  return {
    items: filters.onlyLowStock ? items.filter((item) => item.isLowStock) : items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getAccessoryDetail(id: string) {
  await requirePermission("inventario.ver");

  const accessory = await prisma.accessory.findUnique({
    where: { id },
    select: {
      id: true,
      category: true,
      name: true,
      brand: true,
      sku: true,
      salePrice: true,
      stockQuantity: true,
      minStock: true,
      isActive: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { firstName: true, lastName: true } },
      updatedBy: { select: { firstName: true, lastName: true } },
      stockMovements: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          reason: true,
          notes: true,
          quantityDelta: true,
          quantityAfter: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
          sale: { select: { id: true, saleNumber: true } },
        },
      },
    },
  });

  if (!accessory) throw errors.noEncontrado("el accesorio");

  return {
    ...accessory,
    salePrice: toNumber(accessory.salePrice),
    isLowStock: accessory.minStock > 0 && accessory.stockQuantity < accessory.minStock,
    createdByName: `${accessory.createdBy.firstName} ${accessory.createdBy.lastName}`,
    updatedByName: accessory.updatedBy
      ? `${accessory.updatedBy.firstName} ${accessory.updatedBy.lastName}`
      : null,
    movements: accessory.stockMovements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      reason: movement.reason,
      notes: movement.notes,
      quantityDelta: movement.quantityDelta,
      quantityAfter: movement.quantityAfter,
      createdAt: movement.createdAt,
      userName: `${movement.user.firstName} ${movement.user.lastName}`,
      saleId: movement.sale?.id ?? null,
      saleNumber: movement.sale?.saleNumber ?? null,
    })),
  };
}

export type AccessoryDetail = Awaited<ReturnType<typeof getAccessoryDetail>>;

export async function createAccessory(input: CreateAccessoryInput): Promise<{ id: string }> {
  const user = await requirePermission("inventario.crear");

  try {
    return await prisma.$transaction(async (tx) => {
      const accessory = await tx.accessory.create({
        data: {
          category: input.category,
          name: input.name,
          brand: input.brand ?? null,
          sku: input.sku ?? null,
          salePrice: input.salePrice,
          stockQuantity: input.initialStock,
          minStock: input.minStock,
          notes: input.notes ?? null,
          createdById: user.id,
        },
        select: { id: true },
      });

      // El stock inicial también deja su movimiento: no hay stock sin origen.
      if (input.initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            accessoryId: accessory.id,
            type: "INGRESO",
            reason: "Stock inicial del accesorio",
            userId: user.id,
            quantityDelta: input.initialStock,
            quantityAfter: input.initialStock,
          },
        });
      }

      await recordAudit(tx, {
        userId: user.id,
        action: "CREAR_ACCESORIO",
        entity: "Accessory",
        entityId: accessory.id,
        changes: {
          nombre: { anterior: null, nuevo: input.name },
          precio: { anterior: null, nuevo: input.salePrice },
          stockInicial: { anterior: null, nuevo: input.initialStock },
        },
      });

      return accessory;
    });
  } catch (error) {
    translateUniqueSkuError(error);
  }
}

/**
 * Edita los datos del accesorio.
 *
 * El stock NO se toca desde acá: se mueve solo con `adjustAccessoryStock`,
 * para que siempre quede un movimiento que explique el cambio.
 */
export async function updateAccessory(id: string, input: AccessoryInput): Promise<void> {
  const user = await requirePermission("inventario.editar");

  const current = await prisma.accessory.findUnique({
    where: { id },
    select: {
      category: true,
      name: true,
      brand: true,
      sku: true,
      salePrice: true,
      minStock: true,
      notes: true,
    },
  });

  if (!current) throw errors.noEncontrado("el accesorio");

  const priceChanged = toNumber(current.salePrice) !== input.salePrice;
  if (priceChanged) {
    await requirePermission("inventario.editar_precio");
  }

  const changes = diffFields(
    { ...current, salePrice: toNumber(current.salePrice) },
    {
      category: input.category,
      name: input.name,
      brand: input.brand ?? null,
      sku: input.sku ?? null,
      salePrice: input.salePrice,
      minStock: input.minStock,
      notes: input.notes ?? null,
    },
    AUDITED_FIELDS,
  );

  if (Object.keys(changes).length === 0) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.accessory.update({
        where: { id },
        data: {
          category: input.category,
          name: input.name,
          brand: input.brand ?? null,
          sku: input.sku ?? null,
          salePrice: input.salePrice,
          minStock: input.minStock,
          notes: input.notes ?? null,
          updatedById: user.id,
        },
      });

      if (priceChanged) {
        await recordAudit(tx, {
          userId: user.id,
          action: "MODIFICAR_PRECIO",
          entity: "Accessory",
          entityId: id,
          changes: {
            salePrice: { anterior: toNumber(current.salePrice), nuevo: input.salePrice },
          },
        });
      }

      const otherChanges = Object.fromEntries(
        Object.entries(changes).filter(([field]) => field !== "salePrice"),
      );

      if (Object.keys(otherChanges).length > 0) {
        await recordAudit(tx, {
          userId: user.id,
          action: "MODIFICAR_ACCESORIO",
          entity: "Accessory",
          entityId: id,
          changes: otherChanges,
        });
      }
    });
  } catch (error) {
    translateUniqueSkuError(error);
  }
}

/**
 * Ajusta el stock de un accesorio.
 *
 * El descuento se hace con un UPDATE condicional: si otro proceso consumió
 * stock en el medio, la condición no se cumple y la operación falla en lugar
 * de dejar el stock en negativo.
 */
export async function adjustAccessoryStock(
  id: string,
  input: StockAdjustmentInput,
): Promise<void> {
  const user = await requirePermission("stock.ajustar");

  await prisma.$transaction(async (tx) => {
    const accessory = await tx.accessory.findUnique({
      where: { id },
      select: { id: true, name: true, stockQuantity: true, isActive: true },
    });

    if (!accessory) throw errors.noEncontrado("el accesorio");

    if (!accessory.isActive) {
      throw errors.regla("Este accesorio está dado de baja: no se puede ajustar su stock.");
    }

    const isDecrease = input.quantityDelta < 0;

    if (isDecrease && accessory.stockQuantity + input.quantityDelta < 0) {
      throw errors.regla(
        `No hay stock suficiente de ${accessory.name}. Disponible: ${accessory.stockQuantity}.`,
      );
    }

    const updated = await tx.accessory.updateMany({
      where: {
        id,
        // Guarda atómica: el stock tiene que seguir alcanzando al momento
        // exacto de escribir.
        ...(isDecrease ? { stockQuantity: { gte: Math.abs(input.quantityDelta) } } : {}),
      },
      data: {
        stockQuantity: { increment: input.quantityDelta },
        updatedById: user.id,
      },
    });

    if (updated.count === 0) {
      throw errors.conflicto(
        "El stock cambió mientras registrabas el ajuste. Revisá el stock actual e intentá de nuevo.",
      );
    }

    const after = accessory.stockQuantity + input.quantityDelta;

    await tx.stockMovement.create({
      data: {
        accessoryId: id,
        type: isDecrease ? "AJUSTE_NEGATIVO" : "AJUSTE_POSITIVO",
        reason: input.reason,
        userId: user.id,
        quantityDelta: input.quantityDelta,
        quantityAfter: after,
      },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "AJUSTE_STOCK",
      entity: "Accessory",
      entityId: id,
      changes: {
        stock: { anterior: accessory.stockQuantity, nuevo: after },
        motivo: { anterior: null, nuevo: input.reason },
      },
    });
  });
}

/// Baja lógica: el accesorio deja de ofrecerse pero conserva su historial.
export async function deactivateAccessory(id: string, reason: string): Promise<void> {
  const user = await requirePermission("inventario.dar_de_baja");

  const accessory = await prisma.accessory.findUnique({
    where: { id },
    select: { id: true, isActive: true, stockQuantity: true },
  });

  if (!accessory) throw errors.noEncontrado("el accesorio");
  if (!accessory.isActive) throw errors.regla("Este accesorio ya está dado de baja.");

  await prisma.$transaction(async (tx) => {
    await tx.accessory.update({
      where: { id },
      data: { isActive: false, updatedById: user.id },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "BAJA_ACCESORIO",
      entity: "Accessory",
      entityId: id,
      changes: {
        activo: { anterior: true, nuevo: false },
        stockAlDarDeBaja: { anterior: null, nuevo: accessory.stockQuantity },
        motivo: { anterior: null, nuevo: reason },
      },
    });
  });
}

/// Accesorios con stock por debajo del mínimo, para el dashboard.
export async function getLowStockAccessories() {
  return prisma.$queryRaw<
    Array<{ id: string; name: string; stockQuantity: number; minStock: number }>
  >`
    SELECT "id", "name", "stockQuantity", "minStock"
    FROM "accessories"
    WHERE "isActive" = true
      AND "minStock" > 0
      AND "stockQuantity" < "minStock"
    ORDER BY "stockQuantity" ASC, "name" ASC
    LIMIT 20
  `;
}

/// Búsqueda para el formulario de venta: solo activos y con stock.
export async function searchAvailableAccessories(term: string, limit = 10) {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  const rows = await prisma.accessory.findMany({
    where: {
      isActive: true,
      stockQuantity: { gt: 0 },
      OR: [
        { name: { contains: trimmed, mode: "insensitive" } },
        { brand: { contains: trimmed, mode: "insensitive" } },
        { sku: { contains: trimmed, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      brand: true,
      category: true,
      salePrice: true,
      stockQuantity: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    salePrice: toNumber(row.salePrice),
    stockQuantity: row.stockQuantity,
  }));
}
