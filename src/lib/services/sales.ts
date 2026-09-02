import {
  FinancingType,
  InstallmentStatus,
  InventoryStatus,
  Prisma,
  SaleStatus,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { errors } from "@/lib/errors";
import { PAGE_SIZE } from "@/lib/constants";
import { toNumber } from "@/lib/serialize";
import { buildInstallmentPlan } from "@/lib/domain/installments";
import { recordAudit } from "./audit";
import type { CancelSaleInput, CreateSaleInput, SaleFilters } from "@/lib/validations/sale";

/// Genera el próximo número de comprobante desde una secuencia de PostgreSQL,
/// que entrega valores únicos incluso con ventas simultáneas.
async function nextSaleNumber(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval('sale_number_seq') AS nextval
  `;
  return `V-${String(rows[0].nextval).padStart(8, "0")}`;
}

export interface SaleListItem {
  id: string;
  saleNumber: string;
  saleDate: Date;
  total: number;
  status: SaleStatus;
  paymentMethod: string;
  financingType: FinancingType;
  installmentCount: number | null;
  sellerName: string;
  customerName: string | null;
  itemCount: number;
}

export async function listSales(filters: SaleFilters) {
  const user = await requirePermission("ventas.ver_propias");
  const seesAll = can(user.role, "ventas.ver_todas");

  const where: Prisma.SaleWhereInput = {
    // Un vendedor consulta únicamente sus propias ventas.
    ...(seesAll ? {} : { sellerId: user.id }),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
    ...(filters.financingType ? { financingType: filters.financingType } : {}),
    ...(seesAll && filters.sellerId ? { sellerId: filters.sellerId } : {}),
  };

  if (filters.dateFrom || filters.dateTo) {
    const to = filters.dateTo ? new Date(filters.dateTo) : undefined;
    to?.setHours(23, 59, 59, 999);
    where.saleDate = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  if (filters.search) {
    const term = filters.search.trim();
    where.OR = [
      { saleNumber: { contains: term, mode: "insensitive" } },
      { customer: { lastName: { contains: term, mode: "insensitive" } } },
      { customer: { firstName: { contains: term, mode: "insensitive" } } },
      { customer: { dni: { contains: term } } },
      { items: { some: { device: { imei: { contains: term } } } } },
    ];
  }

  const [total, rows, totals] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      orderBy: { saleDate: "desc" },
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        saleNumber: true,
        saleDate: true,
        total: true,
        status: true,
        paymentMethod: true,
        financingType: true,
        installmentCount: true,
        seller: { select: { firstName: true, lastName: true } },
        customer: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    }),
    // El total facturado excluye las ventas anuladas.
    prisma.sale.aggregate({
      where: { ...where, status: SaleStatus.COMPLETADA },
      _sum: { total: true },
    }),
  ]);

  return {
    items: rows.map<SaleListItem>((sale) => ({
      id: sale.id,
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      total: toNumber(sale.total),
      status: sale.status,
      paymentMethod: sale.paymentMethod,
      financingType: sale.financingType,
      installmentCount: sale.installmentCount,
      sellerName: `${sale.seller.firstName} ${sale.seller.lastName}`,
      customerName: sale.customer
        ? `${sale.customer.firstName} ${sale.customer.lastName}`
        : null,
      itemCount: sale._count.items,
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    amountTotal: toNumber(totals._sum.total),
    seesAll,
  };
}

export async function getSaleDetail(id: string) {
  const user = await requirePermission("ventas.ver_propias");
  const seesAll = can(user.role, "ventas.ver_todas");

  const sale = await prisma.sale.findUnique({
    where: { id },
    select: {
      id: true,
      saleNumber: true,
      saleDate: true,
      sellerId: true,
      subtotal: true,
      discount: true,
      total: true,
      paymentMethod: true,
      financingType: true,
      installmentCount: true,
      status: true,
      notes: true,
      cancelledAt: true,
      cancellationReason: true,
      createdAt: true,
      seller: { select: { firstName: true, lastName: true } },
      cancelledBy: { select: { firstName: true, lastName: true } },
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dni: true,
          phone: true,
          email: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          discount: true,
          lineTotal: true,
          device: {
            select: {
              id: true,
              type: true,
              imei: true,
              color: true,
              storageGb: true,
              condition: true,
              batteryPercent: true,
              inventoryStatus: true,
              model: { select: { name: true, brand: { select: { name: true } } } },
            },
          },
          accessory: {
            select: { id: true, name: true, brand: true, category: true },
          },
        },
      },
      installments: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          dueDate: true,
          amount: true,
          status: true,
          paidAt: true,
          paidAmount: true,
        },
      },
    },
  });

  if (!sale) throw errors.noEncontrado("la venta");

  // Un vendedor no puede abrir la venta de otro escribiendo la URL.
  if (!seesAll && sale.sellerId !== user.id) {
    throw errors.sinPermisos("Solo podés consultar tus propias ventas.");
  }

  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    saleDate: sale.saleDate,
    subtotal: toNumber(sale.subtotal),
    discount: toNumber(sale.discount),
    total: toNumber(sale.total),
    paymentMethod: sale.paymentMethod,
    financingType: sale.financingType,
    installmentCount: sale.installmentCount,
    status: sale.status,
    notes: sale.notes,
    cancelledAt: sale.cancelledAt,
    cancellationReason: sale.cancellationReason,
    createdAt: sale.createdAt,
    sellerName: `${sale.seller.firstName} ${sale.seller.lastName}`,
    cancelledByName: sale.cancelledBy
      ? `${sale.cancelledBy.firstName} ${sale.cancelledBy.lastName}`
      : null,
    customer: sale.customer,
    items: sale.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      discount: toNumber(item.discount),
      lineTotal: toNumber(item.lineTotal),
      device: item.device
        ? {
            id: item.device.id,
            type: item.device.type,
            imei: item.device.imei,
            color: item.device.color,
            storageGb: item.device.storageGb,
            condition: item.device.condition,
            batteryPercent: item.device.batteryPercent,
            inventoryStatus: item.device.inventoryStatus,
            brandName: item.device.model.brand.name,
            modelName: item.device.model.name,
          }
        : null,
      accessory: item.accessory
        ? {
            id: item.accessory.id,
            name: item.accessory.name,
            brand: item.accessory.brand,
            category: item.accessory.category,
          }
        : null,
    })),
    installments: sale.installments.map((installment) => ({
      id: installment.id,
      number: installment.number,
      dueDate: installment.dueDate,
      amount: toNumber(installment.amount),
      status: installment.status,
      paidAt: installment.paidAt,
      paidAmount: installment.paidAmount ? toNumber(installment.paidAmount) : null,
    })),
  };
}

export type SaleDetail = Awaited<ReturnType<typeof getSaleDetail>>;

/**
 * Registra una venta.
 *
 * Todo ocurre en una única transacción: si cualquier paso falla, no queda nada
 * a medias — ni venta sin stock descontado, ni equipo vendido sin comprobante.
 *
 * El precio de cada unidad se lee de la base, nunca del cliente.
 */
export async function createSale(input: CreateSaleInput): Promise<{ id: string; saleNumber: string }> {
  const user = await requirePermission("ventas.registrar");

  return prisma.$transaction(async (tx) => {
    const devices = await tx.device.findMany({
      where: { id: { in: input.deviceIds } },
      select: {
        id: true,
        salePrice: true,
        inventoryStatus: true,
        imei: true,
        model: { select: { name: true, brand: { select: { name: true } } } },
      },
    });

    if (devices.length !== input.deviceIds.length) {
      throw errors.noEncontrado("alguno de los equipos seleccionados");
    }

    // Validación con mensaje claro antes del bloqueo atómico.
    const unavailable = devices.filter(
      (device) => device.inventoryStatus !== InventoryStatus.DISPONIBLE,
    );

    if (unavailable.length > 0) {
      const device = unavailable[0];
      const label = `${device.model.brand.name} ${device.model.name}${
        device.imei ? ` (IMEI ${device.imei})` : ""
      }`;

      throw errors.regla(
        device.inventoryStatus === InventoryStatus.VENDIDO
          ? `No se puede vender ${label} porque ya fue vendido.`
          : `No se puede vender ${label} porque no está disponible.`,
      );
    }

    // Accesorios: se validan stock y precio contra la base.
    const accessoryIds = input.accessoryItems.map((item) => item.accessoryId);
    const accessories =
      accessoryIds.length > 0
        ? await tx.accessory.findMany({
            where: { id: { in: accessoryIds } },
            select: {
              id: true,
              name: true,
              salePrice: true,
              stockQuantity: true,
              isActive: true,
            },
          })
        : [];

    if (accessories.length !== accessoryIds.length) {
      throw errors.noEncontrado("alguno de los accesorios seleccionados");
    }

    const accessoryById = new Map(accessories.map((accessory) => [accessory.id, accessory]));

    for (const item of input.accessoryItems) {
      const accessory = accessoryById.get(item.accessoryId)!;

      if (!accessory.isActive) {
        throw errors.regla(`${accessory.name} está dado de baja y no puede venderse.`);
      }

      if (accessory.stockQuantity < item.quantity) {
        throw errors.regla(
          `No hay stock suficiente de ${accessory.name}. Disponible: ${accessory.stockQuantity}, pedido: ${item.quantity}.`,
        );
      }
    }

    if (input.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true },
      });
      if (!customer) throw errors.noEncontrado("el cliente");
    }

    const devicesSubtotal = devices.reduce(
      (sum, device) => sum + toNumber(device.salePrice),
      0,
    );
    const accessoriesSubtotal = input.accessoryItems.reduce((sum, item) => {
      const accessory = accessoryById.get(item.accessoryId)!;
      return sum + toNumber(accessory.salePrice) * item.quantity;
    }, 0);

    const subtotal = devicesSubtotal + accessoriesSubtotal;

    if (input.discount > subtotal) {
      throw errors.regla("El descuento no puede superar el total de la venta.");
    }

    const total = subtotal - input.discount;
    const saleNumber = await nextSaleNumber(tx);

    const sale = await tx.sale.create({
      data: {
        saleNumber,
        sellerId: user.id,
        customerId: input.customerId ?? null,
        subtotal,
        discount: input.discount,
        total,
        paymentMethod: input.paymentMethod,
        financingType: input.financingType,
        installmentCount:
          input.financingType === FinancingType.CONTADO
            ? null
            : (input.installmentCount ?? null),
        notes: input.notes ?? null,
      },
      select: { id: true, saleNumber: true },
    });

    await tx.saleItem.createMany({
      data: [
        ...devices.map((device) => ({
          saleId: sale.id,
          deviceId: device.id,
          quantity: 1,
          unitPrice: toNumber(device.salePrice),
          discount: 0,
          lineTotal: toNumber(device.salePrice),
        })),
        ...input.accessoryItems.map((item) => {
          const accessory = accessoryById.get(item.accessoryId)!;
          const unitPrice = toNumber(accessory.salePrice);

          return {
            saleId: sale.id,
            accessoryId: item.accessoryId,
            quantity: item.quantity,
            unitPrice,
            discount: 0,
            lineTotal: unitPrice * item.quantity,
          };
        }),
      ],
    });

    /*
     * Guarda atómica contra la doble venta.
     *
     * El UPDATE solo alcanza a los equipos que SIGUEN disponibles. Si otra
     * venta simultánea se adelantó, `count` no coincide y la transacción
     * entera se revierte. La verificación previa da buenos mensajes; esta
     * línea es la que garantiza la regla.
     */
    if (input.deviceIds.length > 0) {
      const claimed = await tx.device.updateMany({
        where: { id: { in: input.deviceIds }, inventoryStatus: InventoryStatus.DISPONIBLE },
        data: { inventoryStatus: InventoryStatus.VENDIDO, updatedById: user.id },
      });

      if (claimed.count !== input.deviceIds.length) {
        throw errors.conflicto(
          "Otro usuario vendió uno de los equipos mientras registrabas esta venta. Revisá el inventario e intentá de nuevo.",
        );
      }
    }

    /*
     * Descuento de stock de accesorios, con la misma garantía atómica.
     *
     * El UPDATE exige que el stock siga alcanzando. Si otra venta simultánea
     * lo consumió, no afecta ninguna fila y la transacción se revierte entera.
     */
    for (const item of input.accessoryItems) {
      const consumed = await tx.accessory.updateMany({
        where: { id: item.accessoryId, stockQuantity: { gte: item.quantity } },
        data: { stockQuantity: { decrement: item.quantity }, updatedById: user.id },
      });

      if (consumed.count === 0) {
        const accessory = accessoryById.get(item.accessoryId)!;
        throw errors.conflicto(
          `Otro usuario vendió unidades de ${accessory.name} mientras registrabas esta venta. Revisá el stock e intentá de nuevo.`,
        );
      }
    }

    // Cada equipo vendido deja su movimiento de stock.
    if (devices.length > 0) {
      await tx.stockMovement.createMany({
        data: devices.map((device) => ({
          deviceId: device.id,
          type: "VENTA" as const,
          reason: `Venta ${sale.saleNumber}`,
          userId: user.id,
          saleId: sale.id,
          previousStatus: InventoryStatus.DISPONIBLE,
          newStatus: InventoryStatus.VENDIDO,
        })),
      });
    }

    // Y cada accesorio, el suyo con la cantidad y el stock resultante.
    if (input.accessoryItems.length > 0) {
      await tx.stockMovement.createMany({
        data: input.accessoryItems.map((item) => {
          const accessory = accessoryById.get(item.accessoryId)!;

          return {
            accessoryId: item.accessoryId,
            type: "VENTA" as const,
            reason: `Venta ${sale.saleNumber}`,
            userId: user.id,
            saleId: sale.id,
            quantityDelta: -item.quantity,
            quantityAfter: accessory.stockQuantity - item.quantity,
          };
        }),
      });
    }

    // Solo la financiación propia del local genera cuotas a cobrar.
    if (input.financingType === FinancingType.FINANCIACION_LOCAL && input.installmentCount) {
      const plan = buildInstallmentPlan(total, input.installmentCount, input.firstDueDate!);

      await tx.installment.createMany({
        data: plan.map((item) => ({
          saleId: sale.id,
          number: item.number,
          dueDate: item.dueDate,
          amount: item.amount,
        })),
      });
    }

    await recordAudit(tx, {
      userId: user.id,
      action: "REGISTRAR_VENTA",
      entity: "Sale",
      entityId: sale.id,
      changes: {
        comprobante: { anterior: null, nuevo: sale.saleNumber },
        total: { anterior: null, nuevo: total },
        equipos: { anterior: null, nuevo: devices.length },
        financiacion: { anterior: null, nuevo: input.financingType },
      },
    });

    return sale;
  });
}

/**
 * Anula una venta.
 *
 * La venta no se elimina: cambia de estado y conserva su historial completo.
 * Los equipos vuelven a estar disponibles solo si siguen marcados como
 * vendidos por esta venta; si alguno fue dado de baja después, se respeta ese
 * estado.
 */
export async function cancelSale(id: string, input: CancelSaleInput): Promise<void> {
  const user = await requirePermission("ventas.anular");

  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      select: {
        id: true,
        saleNumber: true,
        status: true,
        items: {
          select: {
            deviceId: true,
            accessoryId: true,
            quantity: true,
            device: { select: { inventoryStatus: true } },
            accessory: { select: { name: true, stockQuantity: true } },
          },
        },
      },
    });

    if (!sale) throw errors.noEncontrado("la venta");

    if (sale.status === SaleStatus.ANULADA) {
      throw errors.regla("Esta venta ya está anulada.");
    }

    const now = new Date();

    await tx.sale.update({
      where: { id },
      data: {
        status: SaleStatus.ANULADA,
        cancelledAt: now,
        cancelledById: user.id,
        cancellationReason: input.reason,
      },
    });

    // Solo se revierten los equipos que siguen en VENDIDO.
    const revertible = sale.items.filter(
      (item) =>
        item.deviceId !== null &&
        item.device?.inventoryStatus === InventoryStatus.VENDIDO,
    );

    if (revertible.length > 0) {
      const deviceIds = revertible.map((item) => item.deviceId!);

      await tx.device.updateMany({
        where: { id: { in: deviceIds }, inventoryStatus: InventoryStatus.VENDIDO },
        data: { inventoryStatus: InventoryStatus.DISPONIBLE, updatedById: user.id },
      });

      // Movimiento inverso: el stock vuelve a entrar.
      await tx.stockMovement.createMany({
        data: deviceIds.map((deviceId) => ({
          deviceId,
          type: "DEVOLUCION" as const,
          reason: `Anulación de la venta ${sale.saleNumber}`,
          userId: user.id,
          saleId: sale.id,
          notes: input.reason,
          previousStatus: InventoryStatus.VENDIDO,
          newStatus: InventoryStatus.DISPONIBLE,
        })),
      });
    }

    /*
     * Los accesorios vuelven al stock.
     *
     * A diferencia de los equipos, acá no hay condición que evaluar: la
     * cantidad vendida siempre se reintegra, porque son unidades
     * intercambiables.
     */
    const accessoryItems = sale.items.filter((item) => item.accessoryId !== null);

    for (const item of accessoryItems) {
      const updated = await tx.accessory.update({
        where: { id: item.accessoryId! },
        data: { stockQuantity: { increment: item.quantity }, updatedById: user.id },
        select: { stockQuantity: true },
      });

      await tx.stockMovement.create({
        data: {
          accessoryId: item.accessoryId!,
          type: "DEVOLUCION",
          reason: `Anulación de la venta ${sale.saleNumber}`,
          userId: user.id,
          saleId: sale.id,
          notes: input.reason,
          quantityDelta: item.quantity,
          quantityAfter: updated.stockQuantity,
        },
      });
    }

    /*
     * Las cuotas pendientes dejan de reclamarse.
     * Las ya cobradas se conservan como PAGADA: registran plata que entró
     * realmente y su devolución es una operación aparte.
     */
    await tx.installment.updateMany({
      where: { saleId: id, status: InstallmentStatus.PENDIENTE },
      data: { status: InstallmentStatus.ANULADA },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "ANULAR_VENTA",
      entity: "Sale",
      entityId: id,
      changes: {
        estado: { anterior: SaleStatus.COMPLETADA, nuevo: SaleStatus.ANULADA },
        motivo: { anterior: null, nuevo: input.reason },
        equiposDevueltos: { anterior: null, nuevo: revertible.length },
        accesoriosDevueltos: {
          anterior: null,
          nuevo: accessoryItems.reduce((sum, item) => sum + item.quantity, 0),
        },
      },
    });
  });
}

/// Vendedores disponibles para filtrar el listado.
export async function getSellers() {
  await requirePermission("ventas.ver_todas");

  return prisma.user.findMany({
    where: { sales: { some: {} } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
}
