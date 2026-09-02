import { InventoryStatus, Prisma, PurchaseStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
import { toNumber, toNullableNumber } from "@/lib/serialize";
import { recordAudit } from "./audit";
import type {
  CancelPurchaseInput,
  CreatePurchaseInput,
  PurchaseFilters,
} from "@/lib/validations/purchase";

/// Numeración de comprobantes de compra, con la misma garantía que las ventas.
async function nextPurchaseNumber(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval('purchase_number_seq') AS nextval
  `;
  return `C-${String(rows[0].nextval).padStart(8, "0")}`;
}

function translateUniqueImeiError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("imei")
  ) {
    throw errors.conflicto(
      "Uno de los IMEI de la compra ya existe en el inventario. Revisá los equipos cargados.",
    );
  }
  throw error;
}

export async function listPurchases(filters: PurchaseFilters) {
  await requirePermission("compras.ver");

  const where: Prisma.PurchaseWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    ...(filters.search
      ? {
          OR: [
            { purchaseNumber: { contains: filters.search, mode: "insensitive" } },
            { supplier: { name: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows, confirmedAgg] = await Promise.all([
    prisma.purchase.count({ where }),
    prisma.purchase.findMany({
      where,
      orderBy: { purchaseDate: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        purchaseNumber: true,
        purchaseDate: true,
        total: true,
        status: true,
        confirmedAt: true,
        supplier: { select: { id: true, name: true } },
        user: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.purchase.aggregate({
      where: { ...where, status: PurchaseStatus.CONFIRMADA },
      _sum: { total: true },
    }),
  ]);

  return {
    items: rows.map((purchase) => ({
      id: purchase.id,
      purchaseNumber: purchase.purchaseNumber,
      purchaseDate: purchase.purchaseDate,
      total: toNumber(purchase.total),
      status: purchase.status,
      confirmedAt: purchase.confirmedAt,
      supplierId: purchase.supplier.id,
      supplierName: purchase.supplier.name,
      userName: `${purchase.user.firstName} ${purchase.user.lastName}`,
      itemCount: purchase._count.items,
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    confirmedTotal: toNumber(confirmedAgg._sum.total),
  };
}

export async function getPurchaseDetail(id: string) {
  await requirePermission("compras.ver");

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    select: {
      id: true,
      purchaseNumber: true,
      purchaseDate: true,
      total: true,
      status: true,
      notes: true,
      confirmedAt: true,
      createdAt: true,
      supplier: {
        select: { id: true, name: true, cuit: true, phone: true, email: true },
      },
      user: { select: { firstName: true, lastName: true } },
      items: {
        select: {
          id: true,
          deviceType: true,
          color: true,
          storageGb: true,
          condition: true,
          batteryPercent: true,
          imei: true,
          serialNumber: true,
          quantity: true,
          unitCost: true,
          salePrice: true,
          deviceId: true,
          model: { select: { name: true, brand: { select: { name: true } } } },
          accessory: { select: { id: true, name: true, category: true } },
        },
      },
    },
  });

  if (!purchase) throw errors.noEncontrado("la compra");

  return {
    id: purchase.id,
    purchaseNumber: purchase.purchaseNumber,
    purchaseDate: purchase.purchaseDate,
    total: toNumber(purchase.total),
    status: purchase.status,
    notes: purchase.notes,
    confirmedAt: purchase.confirmedAt,
    createdAt: purchase.createdAt,
    supplier: purchase.supplier,
    userName: `${purchase.user.firstName} ${purchase.user.lastName}`,
    items: purchase.items.map((item) => ({
      id: item.id,
      isDevice: item.model !== null,
      deviceType: item.deviceType,
      brandName: item.model?.brand.name ?? null,
      modelName: item.model?.name ?? null,
      color: item.color,
      storageGb: item.storageGb,
      condition: item.condition,
      batteryPercent: item.batteryPercent,
      imei: item.imei,
      serialNumber: item.serialNumber,
      accessoryId: item.accessory?.id ?? null,
      accessoryName: item.accessory?.name ?? null,
      accessoryCategory: item.accessory?.category ?? null,
      quantity: item.quantity,
      unitCost: toNumber(item.unitCost),
      salePrice: toNullableNumber(item.salePrice),
      lineTotal: toNumber(item.unitCost) * item.quantity,
      deviceId: item.deviceId,
    })),
  };
}

export type PurchaseDetail = Awaited<ReturnType<typeof getPurchaseDetail>>;

/**
 * Crea una compra en estado BORRADOR.
 *
 * En borrador no se toca el inventario: la compra es solo un documento hasta
 * que se confirma.
 */
export async function createPurchase(
  input: CreatePurchaseInput,
): Promise<{ id: string; purchaseNumber: string }> {
  const user = await requirePermission("compras.gestionar");

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({
      where: { id: input.supplierId },
      select: { id: true },
    });
    if (!supplier) throw errors.noEncontrado("el proveedor");

    const deviceItems = input.items.filter((item) => item.kind === "equipo");
    const accessoryItems = input.items.filter((item) => item.kind === "accesorio");

    // Se valida el catálogo antes de escribir, para dar mensajes claros.
    const modelIds = [...new Set(deviceItems.map((item) => item.modelId))];
    if (modelIds.length > 0) {
      const models = await tx.deviceModel.count({ where: { id: { in: modelIds } } });
      if (models !== modelIds.length) throw errors.noEncontrado("alguno de los modelos");
    }

    const accessoryIds = [...new Set(accessoryItems.map((item) => item.accessoryId))];
    if (accessoryIds.length > 0) {
      const found = await tx.accessory.findMany({
        where: { id: { in: accessoryIds } },
        select: { id: true, name: true, isActive: true },
      });

      if (found.length !== accessoryIds.length) {
        throw errors.noEncontrado("alguno de los accesorios");
      }

      const inactive = found.find((accessory) => !accessory.isActive);
      if (inactive) {
        throw errors.regla(`${inactive.name} está dado de baja y no puede comprarse.`);
      }
    }

    // Los IMEI repetidos dentro de la misma compra se detectan acá: la base
    // solo los rechazaría al confirmar, cuando se crean los equipos.
    const imeis = deviceItems.map((item) => item.imei).filter(Boolean) as string[];
    if (new Set(imeis).size !== imeis.length) {
      throw errors.validacion("Hay un IMEI repetido entre los equipos de la compra.");
    }

    const total = input.items.reduce((sum, item) => {
      const quantity = item.kind === "accesorio" ? item.quantity : 1;
      return sum + item.unitCost * quantity;
    }, 0);

    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber: await nextPurchaseNumber(tx),
        supplierId: input.supplierId,
        purchaseDate: input.purchaseDate,
        total,
        userId: user.id,
        notes: input.notes ?? null,
        items: {
          create: input.items.map((item) =>
            item.kind === "equipo"
              ? {
                  modelId: item.modelId,
                  deviceType: item.deviceType,
                  color: item.color,
                  storageGb: item.storageGb ?? null,
                  condition: item.condition,
                  batteryPercent: item.batteryPercent ?? null,
                  imei: item.imei ?? null,
                  serialNumber: item.serialNumber ?? null,
                  salePrice: item.salePrice,
                  quantity: 1,
                  unitCost: item.unitCost,
                }
              : {
                  accessoryId: item.accessoryId,
                  quantity: item.quantity,
                  unitCost: item.unitCost,
                },
          ),
        },
      },
      select: { id: true, purchaseNumber: true },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "CREAR_COMPRA",
      entity: "Purchase",
      entityId: purchase.id,
      changes: {
        comprobante: { anterior: null, nuevo: purchase.purchaseNumber },
        total: { anterior: null, nuevo: total },
        items: { anterior: null, nuevo: input.items.length },
      },
    });

    return purchase;
  });
}

/**
 * Confirma la compra e ingresa el stock automáticamente.
 *
 * Todo pasa en una transacción: se crean los equipos, se suma el stock de los
 * accesorios y se registran los movimientos. Si algo falla, la compra sigue en
 * borrador y el inventario queda intacto.
 */
export async function confirmPurchase(id: string): Promise<void> {
  const user = await requirePermission("compras.gestionar");

  try {
    await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id },
        select: {
          id: true,
          purchaseNumber: true,
          purchaseDate: true,
          status: true,
          items: {
            select: {
              id: true,
              modelId: true,
              deviceType: true,
              color: true,
              storageGb: true,
              condition: true,
              batteryPercent: true,
              imei: true,
              serialNumber: true,
              salePrice: true,
              unitCost: true,
              accessoryId: true,
              quantity: true,
            },
          },
        },
      });

      if (!purchase) throw errors.noEncontrado("la compra");

      if (purchase.status === PurchaseStatus.CONFIRMADA) {
        throw errors.regla("Esta compra ya fue confirmada.");
      }
      if (purchase.status === PurchaseStatus.ANULADA) {
        throw errors.regla("Esta compra está anulada y no puede confirmarse.");
      }

      const now = new Date();

      for (const item of purchase.items) {
        if (item.modelId) {
          // Cada ítem de equipo crea su unidad en el inventario.
          const device = await tx.device.create({
            data: {
              modelId: item.modelId,
              type: item.deviceType ?? "CELULAR",
              color: item.color!,
              storageGb: item.storageGb,
              condition: item.condition!,
              batteryPercent: item.batteryPercent,
              imei: item.imei,
              serialNumber: item.serialNumber,
              purchasePrice: item.unitCost,
              salePrice: item.salePrice!,
              entryDate: purchase.purchaseDate,
              inventoryStatus: InventoryStatus.DISPONIBLE,
              createdById: user.id,
            },
            select: { id: true },
          });

          await tx.purchaseItem.update({
            where: { id: item.id },
            data: { deviceId: device.id },
          });

          await tx.stockMovement.create({
            data: {
              deviceId: device.id,
              type: "INGRESO",
              reason: `Compra ${purchase.purchaseNumber}`,
              userId: user.id,
              newStatus: InventoryStatus.DISPONIBLE,
              createdAt: purchase.purchaseDate,
            },
          });

          continue;
        }

        // Ítem de accesorio: suma unidades al stock existente.
        const updated = await tx.accessory.update({
          where: { id: item.accessoryId! },
          data: { stockQuantity: { increment: item.quantity }, updatedById: user.id },
          select: { stockQuantity: true },
        });

        await tx.stockMovement.create({
          data: {
            accessoryId: item.accessoryId!,
            type: "INGRESO",
            reason: `Compra ${purchase.purchaseNumber}`,
            userId: user.id,
            quantityDelta: item.quantity,
            quantityAfter: updated.stockQuantity,
            createdAt: purchase.purchaseDate,
          },
        });
      }

      await tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.CONFIRMADA, confirmedAt: now },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "CONFIRMAR_COMPRA",
        entity: "Purchase",
        entityId: id,
        changes: {
          estado: { anterior: PurchaseStatus.BORRADOR, nuevo: PurchaseStatus.CONFIRMADA },
          equiposIngresados: {
            anterior: null,
            nuevo: purchase.items.filter((item) => item.modelId).length,
          },
          unidadesDeAccesorios: {
            anterior: null,
            nuevo: purchase.items
              .filter((item) => item.accessoryId)
              .reduce((sum, item) => sum + item.quantity, 0),
          },
        },
      });
    });
  } catch (error) {
    translateUniqueImeiError(error);
  }
}

/**
 * Anula una compra en borrador.
 *
 * Una compra ya confirmada NO se anula: su stock puede haberse vendido o
 * ajustado, y revertirlo automáticamente dejaría el inventario inconsistente.
 * Para corregirla hay que dar de baja los equipos o ajustar el stock, que son
 * operaciones que quedan registradas por separado.
 */
export async function cancelPurchase(
  id: string,
  input: CancelPurchaseInput,
): Promise<void> {
  const user = await requirePermission("compras.gestionar");

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    select: { id: true, status: true, purchaseNumber: true },
  });

  if (!purchase) throw errors.noEncontrado("la compra");

  if (purchase.status === PurchaseStatus.ANULADA) {
    throw errors.regla("Esta compra ya está anulada.");
  }

  if (purchase.status === PurchaseStatus.CONFIRMADA) {
    throw errors.regla(
      "Una compra confirmada no puede anularse: su stock ya ingresó y puede haberse vendido. " +
        "Para corregirla, dá de baja los equipos ingresados o ajustá el stock de los accesorios.",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchase.update({
      where: { id },
      data: { status: PurchaseStatus.ANULADA },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "ANULAR_COMPRA",
      entity: "Purchase",
      entityId: id,
      changes: {
        estado: { anterior: PurchaseStatus.BORRADOR, nuevo: PurchaseStatus.ANULADA },
        motivo: { anterior: null, nuevo: input.reason },
      },
    });
  });
}

/// Accesorios activos disponibles para reponer desde una compra.
export async function getAccessoryOptions() {
  await requirePermission("compras.gestionar");

  const rows = await prisma.accessory.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      stockQuantity: true,
      salePrice: true,
    },
  });

  return rows.map((row) => ({ ...row, salePrice: toNumber(row.salePrice) }));
}
