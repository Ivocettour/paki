import { NextRequest } from "next/server";
import {
  DEVICE_TYPE_LABELS,
  FINANCING_TYPE_LABELS,
  INVENTORY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
  STOCK_MOVEMENT_LABELS,
} from "@/lib/constants";
import { buildCsv, csvFileName, csvResponse, type CsvColumn } from "@/lib/csv";
import { requirePermission } from "@/lib/auth/session";
import { toUserMessage } from "@/lib/errors";
import {
  getInventoryReport,
  getLowStockReport,
  getMovementsReport,
  getSalesReport,
  getSoldProductsReport,
  type InventoryReportRow,
  type LowStockRow,
  type MovementReportRow,
  type SalesReportRow,
  type SoldProductRow,
} from "@/lib/services/reports";
import { reportFiltersSchema } from "@/lib/validations/report";

/// Traduce una clave de enum a su etiqueta, sin romper si aparece una nueva.
function label<T extends string>(
  labels: Record<T, string>,
  value: string,
): string {
  return (labels as Record<string, string>)[value] ?? value;
}

const INVENTORY_COLUMNS: CsvColumn<InventoryReportRow>[] = [
  { header: "Tipo", value: (row) => label(DEVICE_TYPE_LABELS, row.tipo) },
  { header: "Marca", value: (row) => row.marca },
  { header: "Producto", value: (row) => row.modelo },
  { header: "Detalle", value: (row) => row.detalle },
  { header: "IMEI", value: (row) => row.imei },
  { header: "Estado", value: (row) => label(INVENTORY_STATUS_LABELS, row.estado) },
  { header: "Cantidad", value: (row) => row.cantidad },
  { header: "Precio unitario", value: (row) => row.precioUnitario },
  { header: "Valor total", value: (row) => row.valorTotal },
  { header: "Fecha de ingreso", value: (row) => row.ingreso },
];

const SALES_COLUMNS: CsvColumn<SalesReportRow>[] = [
  { header: "Comprobante", value: (row) => row.comprobante },
  { header: "Fecha", value: (row) => row.fecha },
  { header: "Vendedor", value: (row) => row.vendedor },
  { header: "Cliente", value: (row) => row.cliente },
  { header: "Productos", value: (row) => row.productos },
  { header: "Método de pago", value: (row) => label(PAYMENT_METHOD_LABELS, row.metodoPago) },
  { header: "Financiación", value: (row) => label(FINANCING_TYPE_LABELS, row.financiacion) },
  { header: "Estado", value: (row) => label(SALE_STATUS_LABELS, row.estado) },
  { header: "Total", value: (row) => row.total },
];

const MOVEMENT_COLUMNS: CsvColumn<MovementReportRow>[] = [
  { header: "Fecha", value: (row) => row.fecha },
  { header: "Tipo", value: (row) => label(STOCK_MOVEMENT_LABELS, row.tipo) },
  { header: "Producto", value: (row) => row.producto },
  { header: "IMEI", value: (row) => row.identificacion },
  { header: "Cantidad", value: (row) => row.cantidad },
  { header: "Motivo", value: (row) => row.motivo },
  { header: "Usuario", value: (row) => row.usuario },
  { header: "Comprobante", value: (row) => row.comprobante },
];

const SOLD_COLUMNS: CsvColumn<SoldProductRow>[] = [
  { header: "Producto", value: (row) => row.producto },
  {
    header: "Tipo",
    value: (row) =>
      row.tipo === "ACCESORIO"
        ? "Accesorio"
        : label(DEVICE_TYPE_LABELS, row.tipo),
  },
  { header: "Unidades", value: (row) => row.unidades },
  { header: "Facturación", value: (row) => row.facturacion },
];

const LOW_STOCK_COLUMNS: CsvColumn<LowStockRow>[] = [
  { header: "Producto", value: (row) => row.producto },
  { header: "Tipo", value: (row) => (row.tipo === "ACCESORIO" ? "Accesorio" : "Equipo") },
  { header: "Disponible", value: (row) => row.disponible },
  { header: "Mínimo", value: (row) => row.minimo },
  { header: "Faltante", value: (row) => row.faltante },
];

/**
 * Descarga de reportes en CSV.
 *
 * La exportación revalida el permiso por su cuenta: es un endpoint accesible
 * por URL, así que no puede confiar en que la pantalla haya escondido el botón.
 * La descarga no aplica el límite de filas de la vista previa.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("reportes.exportar");

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = reportFiltersSchema.safeParse(params);

    if (!parsed.success) {
      return Response.json({ error: "Los filtros del reporte no son válidos." }, { status: 400 });
    }

    const filters = parsed.data;

    switch (filters.type) {
      case "inventario": {
        const report = await getInventoryReport(filters);
        return csvResponse(
          buildCsv(report.rows, INVENTORY_COLUMNS),
          csvFileName("inventario"),
        );
      }
      case "ventas": {
        const report = await getSalesReport(filters);
        return csvResponse(buildCsv(report.rows, SALES_COLUMNS), csvFileName("ventas"));
      }
      case "movimientos": {
        const report = await getMovementsReport(filters);
        return csvResponse(
          buildCsv(report.rows, MOVEMENT_COLUMNS),
          csvFileName("movimientos"),
        );
      }
      case "productos-vendidos": {
        const report = await getSoldProductsReport(filters);
        return csvResponse(
          buildCsv(report.rows, SOLD_COLUMNS),
          csvFileName("productos-vendidos"),
        );
      }
      case "stock-bajo": {
        const report = await getLowStockReport();
        return csvResponse(
          buildCsv(report.rows, LOW_STOCK_COLUMNS),
          csvFileName("stock-bajo"),
        );
      }
    }
  } catch (error) {
    const { message, code } = toUserMessage(error);
    const status = code === "NO_AUTENTICADO" ? 401 : code === "SIN_PERMISOS" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
