import { z } from "zod";
import { InventoryStatus, StockMovementType } from "@prisma/client";

export const REPORT_TYPES = [
  "inventario",
  "ventas",
  "movimientos",
  "productos-vendidos",
  "stock-bajo",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABELS: Record<ReportType, string> = {
  inventario: "Inventario actual",
  ventas: "Ventas por período",
  movimientos: "Movimientos de stock",
  "productos-vendidos": "Productos vendidos",
  "stock-bajo": "Stock bajo",
};

export const REPORT_DESCRIPTIONS: Record<ReportType, string> = {
  inventario: "Equipos y accesorios en stock, valorizados a precio de venta.",
  ventas: "Ventas del período, con apertura por vendedor y método de pago.",
  movimientos: "Ingresos, ventas, ajustes, devoluciones y bajas.",
  "productos-vendidos": "Ranking de lo más vendido, en unidades y facturación.",
  "stock-bajo": "Modelos y accesorios por debajo del mínimo configurado.",
};

export const reportFiltersSchema = z.object({
  type: z.enum(REPORT_TYPES).default("ventas"),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  userId: z.string().optional(),
  brandId: z.string().optional(),
  modelId: z.string().optional(),
  inventoryStatus: z.enum(InventoryStatus).optional(),
  movementType: z.enum(StockMovementType).optional(),
});

export type ReportFilters = z.output<typeof reportFiltersSchema>;
