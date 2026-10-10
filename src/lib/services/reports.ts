import { InventoryStatus, Prisma, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { toNumber, toNullableNumber } from "@/lib/serialize";
import { DEVICE_CONDITION_LABELS } from "@/lib/constants";
import type { ReportFilters } from "@/lib/validations/report";

/// Límite de filas que se muestran en pantalla. La exportación a CSV no lo aplica.
export const REPORT_PREVIEW_LIMIT = 200;

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/// Rango de fechas reutilizable. Si no hay filtro, no acota nada.
function dateRange(filters: ReportFilters) {
  if (!filters.dateFrom && !filters.dateTo) return undefined;
  return {
    ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
    ...(filters.dateTo ? { lte: endOfDay(filters.dateTo) } : {}),
  };
}

// ---------------------------------------------------------------------------
// Inventario actual
// ---------------------------------------------------------------------------

export interface InventoryReportRow {
  tipo: string;
  marca: string;
  modelo: string;
  detalle: string;
  imei: string | null;
  estado: string;
  cantidad: number;
  precioUnitario: number;
  valorTotal: number;
  ingreso: Date | null;
}

export async function getInventoryReport(filters: ReportFilters, limit?: number) {
  await requirePermission("reportes.ver");

  const where: Prisma.DeviceWhereInput = {
    // Por defecto el inventario muestra lo que está en stock.
    inventoryStatus: filters.inventoryStatus ?? InventoryStatus.DISPONIBLE,
    ...(filters.modelId ? { modelId: filters.modelId } : {}),
    ...(filters.brandId ? { model: { brandId: filters.brandId } } : {}),
    ...(dateRange(filters) ? { entryDate: dateRange(filters) } : {}),
  };

  const [devices, deviceAgg, accessories] = await Promise.all([
    prisma.device.findMany({
      where,
      orderBy: [{ entryDate: "desc" }],
      ...(limit ? { take: limit } : {}),
      select: {
        id: true,
        type: true,
        color: true,
        storageGb: true,
        condition: true,
        batteryPercent: true,
        imei: true,
        salePrice: true,
        inventoryStatus: true,
        entryDate: true,
        model: { select: { name: true, brand: { select: { name: true } } } },
      },
    }),
    prisma.device.aggregate({ where, _count: true, _sum: { salePrice: true } }),
    // Los accesorios solo entran cuando no se filtró por marca o modelo,
    // que son atributos exclusivos de los equipos.
    filters.brandId || filters.modelId
      ? Promise.resolve([])
      : prisma.accessory.findMany({
          where: { isActive: true, stockQuantity: { gt: 0 } },
          orderBy: [{ category: "asc" }, { name: "asc" }],
          select: {
            id: true,
            category: true,
            name: true,
            brand: true,
            salePrice: true,
            stockQuantity: true,
          },
        }),
  ]);

  const deviceRows: InventoryReportRow[] = devices.map((device) => ({
    tipo: device.type,
    marca: device.model.brand.name,
    modelo: device.model.name,
    detalle: [
      device.color,
      device.storageGb ? `${device.storageGb} GB` : null,
      device.batteryPercent !== null ? `batería ${device.batteryPercent}%` : null,
      DEVICE_CONDITION_LABELS[device.condition].toLowerCase(),
    ]
      .filter(Boolean)
      .join(" · "),
    imei: device.imei,
    estado: device.inventoryStatus,
    cantidad: 1,
    precioUnitario: toNumber(device.salePrice),
    valorTotal: toNumber(device.salePrice),
    ingreso: device.entryDate,
  }));

  const accessoryRows: InventoryReportRow[] = accessories.map((accessory) => ({
    tipo: "ACCESORIO",
    marca: accessory.brand ?? "—",
    modelo: accessory.name,
    detalle: accessory.category,
    imei: null,
    estado: "DISPONIBLE",
    cantidad: accessory.stockQuantity,
    precioUnitario: toNumber(accessory.salePrice),
    valorTotal: toNumber(accessory.salePrice) * accessory.stockQuantity,
    ingreso: null,
  }));

  const accessoriesValue = accessoryRows.reduce((sum, row) => sum + row.valorTotal, 0);
  const accessoriesUnits = accessoryRows.reduce((sum, row) => sum + row.cantidad, 0);

  return {
    rows: [...deviceRows, ...accessoryRows],
    summary: {
      deviceCount: deviceAgg._count,
      deviceValue: toNumber(deviceAgg._sum.salePrice),
      accessoryUnits: accessoriesUnits,
      accessoryValue: accessoriesValue,
      totalValue: toNumber(deviceAgg._sum.salePrice) + accessoriesValue,
    },
    truncated: Boolean(limit && deviceAgg._count > limit),
  };
}

// ---------------------------------------------------------------------------
// Ventas por período
// ---------------------------------------------------------------------------

export interface SalesReportRow {
  comprobante: string;
  fecha: Date;
  vendedor: string;
  cliente: string;
  productos: number;
  metodoPago: string;
  financiacion: string;
  estado: string;
  total: number;
}

export async function getSalesReport(filters: ReportFilters, limit?: number) {
  await requirePermission("reportes.ver");

  const where: Prisma.SaleWhereInput = {
    ...(filters.userId ? { sellerId: filters.userId } : {}),
    ...(dateRange(filters) ? { saleDate: dateRange(filters) } : {}),
  };

  const completedWhere = { ...where, status: SaleStatus.COMPLETADA };

  const [sales, completedAgg, cancelledAgg, bySeller, byPayment] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { saleDate: "desc" },
      ...(limit ? { take: limit } : {}),
      select: {
        id: true,
        saleNumber: true,
        saleDate: true,
        total: true,
        status: true,
        paymentMethod: true,
        financingType: true,
        seller: { select: { firstName: true, lastName: true } },
        customer: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.sale.aggregate({ where: completedWhere, _count: true, _sum: { total: true } }),
    prisma.sale.aggregate({
      where: { ...where, status: SaleStatus.ANULADA },
      _count: true,
      _sum: { total: true },
    }),
    prisma.sale.groupBy({
      by: ["sellerId"],
      where: completedWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: completedWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
  ]);

  // Los nombres de vendedor se resuelven en una consulta aparte porque
  // `groupBy` no admite incluir relaciones.
  const sellerIds = bySeller.map((row) => row.sellerId);
  const sellers = sellerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: sellerIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const sellerName = new Map(
    sellers.map((seller) => [seller.id, `${seller.firstName} ${seller.lastName}`]),
  );

  const completedCount = completedAgg._count;
  const completedTotal = toNumber(completedAgg._sum.total);

  return {
    rows: sales.map<SalesReportRow>((sale) => ({
      comprobante: sale.saleNumber,
      fecha: sale.saleDate,
      vendedor: `${sale.seller.firstName} ${sale.seller.lastName}`,
      cliente: sale.customer
        ? `${sale.customer.firstName} ${sale.customer.lastName}`
        : "Consumidor final",
      productos: sale._count.items,
      metodoPago: sale.paymentMethod,
      financiacion: sale.financingType,
      estado: sale.status,
      total: toNumber(sale.total),
    })),
    summary: {
      completedCount,
      completedTotal,
      // El ticket promedio no tiene sentido sin ventas.
      averageTicket: completedCount > 0 ? completedTotal / completedCount : 0,
      cancelledCount: cancelledAgg._count,
      cancelledTotal: toNumber(cancelledAgg._sum.total),
    },
    bySeller: bySeller
      .map((row) => ({
        name: sellerName.get(row.sellerId) ?? "—",
        count: row._count._all,
        total: toNumber(row._sum.total),
      }))
      .sort((a, b) => b.total - a.total),
    byPaymentMethod: byPayment
      .map((row) => ({
        method: row.paymentMethod,
        count: row._count._all,
        total: toNumber(row._sum.total),
      }))
      .sort((a, b) => b.total - a.total),
    truncated: Boolean(limit && sales.length === limit),
  };
}

// ---------------------------------------------------------------------------
// Movimientos de stock
// ---------------------------------------------------------------------------

export interface MovementReportRow {
  id: string;
  fecha: Date;
  tipo: string;
  producto: string;
  identificacion: string | null;
  cantidad: number | null;
  motivo: string;
  usuario: string;
  comprobante: string | null;
  saleId: string | null;
  deviceId: string | null;
}

export async function getMovementsReport(filters: ReportFilters, limit?: number) {
  await requirePermission("stock.ver_movimientos");

  const where: Prisma.StockMovementWhereInput = {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.movementType ? { type: filters.movementType } : {}),
    ...(dateRange(filters) ? { createdAt: dateRange(filters) } : {}),
    ...(filters.modelId ? { device: { modelId: filters.modelId } } : {}),
    ...(filters.brandId ? { device: { model: { brandId: filters.brandId } } } : {}),
  };

  const [total, movements, byType] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: limit } : {}),
      select: {
        id: true,
        type: true,
        reason: true,
        notes: true,
        createdAt: true,
        quantityDelta: true,
        deviceId: true,
        user: { select: { firstName: true, lastName: true } },
        sale: { select: { id: true, saleNumber: true } },
        device: {
          select: {
            imei: true,
            color: true,
            model: { select: { name: true, brand: { select: { name: true } } } },
          },
        },
        accessory: { select: { name: true } },
      },
    }),
    prisma.stockMovement.groupBy({ by: ["type"], where, _count: { _all: true } }),
  ]);

  return {
    rows: movements.map<MovementReportRow>((movement) => ({
      id: movement.id,
      fecha: movement.createdAt,
      tipo: movement.type,
      producto: movement.device
        ? `${movement.device.model.brand.name} ${movement.device.model.name}`
        : (movement.accessory?.name ?? "—"),
      identificacion: movement.device?.imei ?? null,
      cantidad: movement.quantityDelta,
      motivo: movement.notes ? `${movement.reason} — ${movement.notes}` : movement.reason,
      usuario: `${movement.user.firstName} ${movement.user.lastName}`,
      comprobante: movement.sale?.saleNumber ?? null,
      saleId: movement.sale?.id ?? null,
      deviceId: movement.deviceId,
    })),
    total,
    byType: byType
      .map((row) => ({ type: row.type, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    truncated: Boolean(limit && total > limit),
  };
}

// ---------------------------------------------------------------------------
// Productos vendidos
// ---------------------------------------------------------------------------

export interface SoldProductRow {
  producto: string;
  tipo: string;
  unidades: number;
  facturacion: number;
}

export async function getSoldProductsReport(filters: ReportFilters) {
  await requirePermission("reportes.ver");

  // Solo cuentan las ventas efectivamente concretadas.
  const saleFilter: Prisma.SaleWhereInput = {
    status: SaleStatus.COMPLETADA,
    ...(filters.userId ? { sellerId: filters.userId } : {}),
    ...(dateRange(filters) ? { saleDate: dateRange(filters) } : {}),
  };

  const items = await prisma.saleItem.findMany({
    where: { sale: saleFilter },
    select: {
      quantity: true,
      lineTotal: true,
      device: {
        select: {
          type: true,
          model: { select: { name: true, brand: { select: { name: true } } } },
        },
      },
      accessory: { select: { name: true, category: true } },
    },
  });

  // La agregación se hace en memoria porque agrupa por una etiqueta que
  // combina marca y modelo, o el nombre del accesorio.
  const grouped = new Map<string, SoldProductRow>();

  for (const item of items) {
    const key = item.device
      ? `equipo:${item.device.model.brand.name} ${item.device.model.name}`
      : `accesorio:${item.accessory?.name ?? "—"}`;

    const existing = grouped.get(key);
    const units = item.quantity;
    const revenue = toNumber(item.lineTotal);

    if (existing) {
      existing.unidades += units;
      existing.facturacion += revenue;
      continue;
    }

    grouped.set(key, {
      producto: item.device
        ? `${item.device.model.brand.name} ${item.device.model.name}`
        : (item.accessory?.name ?? "—"),
      tipo: item.device ? item.device.type : "ACCESORIO",
      unidades: units,
      facturacion: revenue,
    });
  }

  const rows = [...grouped.values()].sort(
    (a, b) => b.facturacion - a.facturacion || b.unidades - a.unidades,
  );

  return {
    rows,
    summary: {
      productCount: rows.length,
      totalUnits: rows.reduce((sum, row) => sum + row.unidades, 0),
      totalRevenue: rows.reduce((sum, row) => sum + row.facturacion, 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Stock bajo
// ---------------------------------------------------------------------------

export interface LowStockRow {
  producto: string;
  tipo: string;
  disponible: number;
  minimo: number;
  faltante: number;
}

export async function getLowStockReport() {
  await requirePermission("reportes.ver");

  const [models, availableByModel, accessories] = await Promise.all([
    prisma.deviceModel.findMany({
      where: { minStock: { gt: 0 } },
      select: { id: true, name: true, minStock: true, brand: { select: { name: true } } },
    }),
    prisma.device.groupBy({
      by: ["modelId"],
      where: { inventoryStatus: InventoryStatus.DISPONIBLE },
      _count: { _all: true },
    }),
    prisma.accessory.findMany({
      where: { isActive: true, minStock: { gt: 0 } },
      select: { id: true, name: true, stockQuantity: true, minStock: true },
    }),
  ]);

  const availableCount = new Map(
    availableByModel.map((row) => [row.modelId, row._count._all]),
  );

  const modelRows: LowStockRow[] = models
    .map((model) => {
      const available = availableCount.get(model.id) ?? 0;
      return {
        producto: `${model.brand.name} ${model.name}`,
        tipo: "EQUIPO",
        disponible: available,
        minimo: model.minStock,
        faltante: model.minStock - available,
      };
    })
    .filter((row) => row.faltante > 0);

  const accessoryRows: LowStockRow[] = accessories
    .map((accessory) => ({
      producto: accessory.name,
      tipo: "ACCESORIO",
      disponible: accessory.stockQuantity,
      minimo: accessory.minStock,
      faltante: accessory.minStock - accessory.stockQuantity,
    }))
    .filter((row) => row.faltante > 0);

  const rows = [...modelRows, ...accessoryRows].sort(
    (a, b) => b.faltante - a.faltante || a.producto.localeCompare(b.producto),
  );

  return {
    rows,
    summary: {
      count: rows.length,
      outOfStock: rows.filter((row) => row.disponible === 0).length,
    },
  };
}

/// Opciones para los selectores de filtro de la pantalla de reportes.
export async function getReportFilterOptions() {
  await requirePermission("reportes.ver");

  const [users, brands] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        models: { orderBy: { name: "asc" }, select: { id: true, name: true } },
      },
    }),
  ]);

  return { users, brands };
}

/// Devuelve el precio de compra total solo si el usuario puede verlo.
export async function getInventoryCostValue(): Promise<number | null> {
  const user = await requirePermission("reportes.ver");
  const { can } = await import("@/lib/auth/permissions");

  if (!can(user.role, "inventario.ver_precio_compra")) return null;

  const result = await prisma.device.aggregate({
    where: { inventoryStatus: InventoryStatus.DISPONIBLE },
    _sum: { purchasePrice: true },
  });

  return toNullableNumber(result._sum.purchasePrice) ?? 0;
}
