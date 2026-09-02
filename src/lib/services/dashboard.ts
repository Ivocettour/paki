import { InventoryStatus, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { toNumber } from "@/lib/serialize";
import { getInstallmentsSummary } from "./installments";
import { getLowStockAccessories } from "./accessories";

export interface LowStockModel {
  modelId: string;
  brandName: string;
  modelName: string;
  available: number;
  minStock: number;
}

export interface LowStockAccessory {
  id: string;
  name: string;
  available: number;
  minStock: number;
}

export interface DashboardData {
  availableDevices: number;
  soldDevices: number;
  salesToday: { count: number; total: number };
  salesThisMonth: { count: number; total: number };
  inventoryValue: number | null;
  lowStock: LowStockModel[];
  lowStockAccessories: LowStockAccessory[];
  recentSales: Array<{
    id: string;
    saleNumber: string;
    saleDate: Date;
    total: number;
    sellerName: string;
    customerName: string | null;
    itemCount: number;
  }>;
  recentMovements: Array<{
    id: string;
    type: string;
    reason: string;
    createdAt: Date;
    userName: string;
    deviceLabel: string;
  }>;
  showsEconomicMetrics: boolean;
  showsMovements: boolean;
  installments: {
    overdueCount: number;
    overdueAmount: number;
    dueSoonCount: number;
    dueSoonAmount: number;
  } | null;
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfMonth(): Date {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export async function getDashboardData(): Promise<DashboardData> {
  const user = await requirePermission("dashboard.ver");
  const showsEconomicMetrics = can(user.role, "dashboard.ver_metricas_economicas");
  const showsMovements = can(user.role, "stock.ver_movimientos");
  const showsInstallments = can(user.role, "cuotas.ver");

  // El vendedor solo ve el resumen de sus propias ventas.
  const salesScope = showsEconomicMetrics ? {} : { sellerId: user.id };

  const [
    availableDevices,
    soldDevices,
    salesTodayAgg,
    salesMonthAgg,
    inventoryValueAgg,
    modelsWithMinStock,
    availableByModel,
    recentSalesRaw,
    recentMovementsRaw,
    installmentsSummary,
    lowStockAccessoriesRaw,
  ] = await Promise.all([
    prisma.device.count({ where: { inventoryStatus: InventoryStatus.DISPONIBLE } }),
    prisma.device.count({ where: { inventoryStatus: InventoryStatus.VENDIDO } }),
    prisma.sale.aggregate({
      where: { status: SaleStatus.COMPLETADA, saleDate: { gte: startOfToday() }, ...salesScope },
      _count: true,
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: { status: SaleStatus.COMPLETADA, saleDate: { gte: startOfMonth() }, ...salesScope },
      _count: true,
      _sum: { total: true },
    }),
    showsEconomicMetrics
      ? prisma.device.aggregate({
          where: { inventoryStatus: InventoryStatus.DISPONIBLE },
          _sum: { salePrice: true },
        })
      : Promise.resolve(null),
    prisma.deviceModel.findMany({
      where: { minStock: { gt: 0 } },
      select: { id: true, name: true, minStock: true, brand: { select: { name: true } } },
    }),
    prisma.device.groupBy({
      by: ["modelId"],
      where: { inventoryStatus: InventoryStatus.DISPONIBLE },
      _count: { _all: true },
    }),
    prisma.sale.findMany({
      where: { status: SaleStatus.COMPLETADA, ...salesScope },
      orderBy: { saleDate: "desc" },
      take: 5,
      select: {
        id: true,
        saleNumber: true,
        saleDate: true,
        total: true,
        seller: { select: { firstName: true, lastName: true } },
        customer: { select: { firstName: true, lastName: true } },
        _count: { select: { items: true } },
      },
    }),
    // Los movimientos de stock son información operativa reservada:
    // el vendedor no los consulta.
    showsMovements
      ? prisma.stockMovement.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            type: true,
            reason: true,
            createdAt: true,
            user: { select: { firstName: true, lastName: true } },
            device: {
              select: {
                imei: true,
                model: { select: { name: true, brand: { select: { name: true } } } },
              },
            },
            accessory: { select: { name: true } },
            quantityDelta: true,
          },
        })
      : Promise.resolve([]),
    // Recordatorio de cuotas: solo las de ventas financiadas por el local.
    showsInstallments
      ? getInstallmentsSummary()
      : Promise.resolve(null),
    // Accesorios bajo el mínimo: solo lo ve quien maneja el inventario.
    showsEconomicMetrics ? getLowStockAccessories() : Promise.resolve([]),
  ]);

  const availableCountByModel = new Map(
    availableByModel.map((row) => [row.modelId, row._count._all]),
  );

  const lowStock: LowStockModel[] = modelsWithMinStock
    .map((model) => ({
      modelId: model.id,
      brandName: model.brand.name,
      modelName: model.name,
      available: availableCountByModel.get(model.id) ?? 0,
      minStock: model.minStock,
    }))
    .filter((model) => model.available < model.minStock)
    .sort((a, b) => a.available - b.available || a.modelName.localeCompare(b.modelName));

  return {
    availableDevices,
    soldDevices,
    salesToday: {
      count: salesTodayAgg._count,
      total: toNumber(salesTodayAgg._sum.total),
    },
    salesThisMonth: {
      count: salesMonthAgg._count,
      total: toNumber(salesMonthAgg._sum.total),
    },
    inventoryValue: inventoryValueAgg ? toNumber(inventoryValueAgg._sum.salePrice) : null,
    lowStock,
    lowStockAccessories: lowStockAccessoriesRaw.map((accessory) => ({
      id: accessory.id,
      name: accessory.name,
      available: accessory.stockQuantity,
      minStock: accessory.minStock,
    })),
    recentSales: recentSalesRaw.map((sale) => ({
      id: sale.id,
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      total: toNumber(sale.total),
      sellerName: `${sale.seller.firstName} ${sale.seller.lastName}`,
      customerName: sale.customer
        ? `${sale.customer.firstName} ${sale.customer.lastName}`
        : null,
      itemCount: sale._count.items,
    })),
    recentMovements: recentMovementsRaw.map((movement) => ({
      id: movement.id,
      type: movement.type,
      reason: movement.reason,
      createdAt: movement.createdAt,
      userName: `${movement.user.firstName} ${movement.user.lastName}`,
      // El movimiento afecta a un equipo individual o a un accesorio.
      deviceLabel: movement.device
        ? `${movement.device.model.brand.name} ${movement.device.model.name}${
            movement.device.imei ? ` · ${movement.device.imei}` : ""
          }`
        : movement.accessory
          ? `${movement.accessory.name}${
              movement.quantityDelta
                ? ` · ${movement.quantityDelta > 0 ? "+" : ""}${movement.quantityDelta}`
                : ""
            }`
          : "—",
    })),
    showsEconomicMetrics,
    showsMovements,
    installments: installmentsSummary
      ? {
          overdueCount: installmentsSummary.overdueCount,
          overdueAmount: installmentsSummary.overdueAmount,
          dueSoonCount: installmentsSummary.dueSoonCount,
          dueSoonAmount: installmentsSummary.dueSoonAmount,
        }
      : null,
  };
}
