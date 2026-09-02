import { redirect } from "next/navigation";
import { FileBarChart } from "lucide-react";
import { REPORT_DESCRIPTIONS, reportFiltersSchema } from "@/lib/validations/report";
import {
  getInventoryReport,
  getLowStockReport,
  getMovementsReport,
  getReportFilterOptions,
  getSalesReport,
  getSoldProductsReport,
  REPORT_PREVIEW_LIMIT,
} from "@/lib/services/reports";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import {
  DEVICE_TYPE_LABELS,
  FINANCING_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
  STOCK_MOVEMENT_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { ReportFilters, ReportTabs } from "./report-controls";
import type { DeviceType, PaymentMethod, StockMovementType } from "@prisma/client";

export const metadata = { title: "Reportes" };

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!can(user?.role, "reportes.ver")) redirect("/");

  const params = await searchParams;
  const parsed = reportFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : reportFiltersSchema.parse({});

  const options = await getReportFilterOptions();
  const canExport = can(user?.role, "reportes.exportar");

  return (
    <>
      <PageHeader title="Reportes" description={REPORT_DESCRIPTIONS[filters.type]} />

      <ReportTabs active={filters.type} />
      <ReportFilters type={filters.type} options={options} canExport={canExport} />

      {filters.type === "inventario" ? <InventoryReport filters={filters} /> : null}
      {filters.type === "ventas" ? <SalesReport filters={filters} /> : null}
      {filters.type === "movimientos" ? <MovementsReport filters={filters} /> : null}
      {filters.type === "productos-vendidos" ? <SoldProductsReport filters={filters} /> : null}
      {filters.type === "stock-bajo" ? <LowStockReport /> : null}
    </>
  );
}

function TruncationNote({ shown }: { shown: number }) {
  return (
    <p className="mt-3 text-[13px] text-fg-tertiary">
      Se muestran las primeras {shown} filas. La exportación a CSV incluye el total.
    </p>
  );
}

// ---------------------------------------------------------------------------

async function InventoryReport({
  filters,
}: {
  filters: Awaited<ReturnType<typeof reportFiltersSchema.parse>>;
}) {
  const report = await getInventoryReport(filters, REPORT_PREVIEW_LIMIT);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Equipos"
          value={String(report.summary.deviceCount)}
          hint={formatCurrency(report.summary.deviceValue)}
        />
        <StatCard
          label="Unidades de accesorios"
          value={String(report.summary.accessoryUnits)}
          hint={formatCurrency(report.summary.accessoryValue)}
        />
        <StatCard
          label="Valor total"
          value={formatCurrency(report.summary.totalValue)}
          hint="A precio de venta"
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        {report.rows.length === 0 ? (
          <EmptyState icon={FileBarChart} title="No hay productos que coincidan" />
        ) : (
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th>Detalle</Th>
                  <Th>IMEI</Th>
                  <Th align="center">Cant.</Th>
                  <Th align="right">Precio</Th>
                  <Th align="right">Valor</Th>
                  <Th>Ingreso</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, index) => (
                  <Tr key={`${row.modelo}-${row.imei ?? index}`}>
                    <Td>
                      <span className="font-medium">
                        {row.marca !== "—" ? `${row.marca} ` : ""}
                        {row.modelo}
                      </span>
                      <span className="block text-[12px] text-fg-tertiary">
                        {row.tipo === "ACCESORIO"
                          ? "Accesorio"
                          : DEVICE_TYPE_LABELS[row.tipo as DeviceType]}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[13px] text-fg-secondary">{row.detalle}</span>
                    </Td>
                    <Td>
                      <span className="tabular text-[13px] text-fg-secondary">
                        {row.imei ?? "—"}
                      </span>
                    </Td>
                    <Td align="center">
                      <span className="tabular">{row.cantidad}</span>
                    </Td>
                    <Td align="right">
                      <span className="tabular text-[13px]">
                        {formatCurrency(row.precioUnitario)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="tabular font-medium">
                        {formatCurrency(row.valorTotal)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[13px] text-fg-secondary">
                        {row.ingreso ? formatDate(row.ingreso) : "—"}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </Card>

      {report.truncated ? <TruncationNote shown={REPORT_PREVIEW_LIMIT} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------

async function SalesReport({
  filters,
}: {
  filters: Awaited<ReturnType<typeof reportFiltersSchema.parse>>;
}) {
  const report = await getSalesReport(filters, REPORT_PREVIEW_LIMIT);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ventas completadas"
          value={String(report.summary.completedCount)}
        />
        <StatCard
          label="Facturación"
          value={formatCurrency(report.summary.completedTotal)}
          hint="Sin ventas anuladas"
        />
        <StatCard
          label="Ticket promedio"
          value={formatCurrency(report.summary.averageTicket)}
        />
        <StatCard
          label="Ventas anuladas"
          value={String(report.summary.cancelledCount)}
          tone={report.summary.cancelledCount > 0 ? "warning" : "neutral"}
          hint={
            report.summary.cancelledCount > 0
              ? formatCurrency(report.summary.cancelledTotal)
              : "Ninguna en el período"
          }
        />
      </div>

      {report.bySeller.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Por vendedor" />
            <ul className="divide-y divide-line-subtle">
              {report.bySeller.map((row) => (
                <li
                  key={row.name}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <span className="text-[14px] text-fg">{row.name}</span>
                  <span className="text-right">
                    <span className="tabular block text-[14px] font-medium">
                      {formatCurrency(row.total)}
                    </span>
                    <span className="block text-[12px] text-fg-tertiary">
                      {row.count} {row.count === 1 ? "venta" : "ventas"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Por método de pago" />
            <ul className="divide-y divide-line-subtle">
              {report.byPaymentMethod.map((row) => (
                <li
                  key={row.method}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <span className="text-[14px] text-fg">
                    {PAYMENT_METHOD_LABELS[row.method as PaymentMethod]}
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-[14px] font-medium">
                      {formatCurrency(row.total)}
                    </span>
                    <span className="block text-[12px] text-fg-tertiary">
                      {row.count} {row.count === 1 ? "venta" : "ventas"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      <Card className="mt-4 overflow-hidden">
        <CardHeader title="Detalle" />
        {report.rows.length === 0 ? (
          <EmptyState
            icon={FileBarChart}
            title="No hay ventas en el período"
            description="Probá ampliando el rango de fechas."
          />
        ) : (
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  <Th>Comprobante</Th>
                  <Th>Fecha</Th>
                  <Th>Vendedor</Th>
                  <Th>Cliente</Th>
                  <Th>Pago</Th>
                  <Th>Estado</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <Tr key={row.comprobante}>
                    <Td>
                      <span className="font-medium">{row.comprobante}</span>
                      <span className="block text-[12px] text-fg-tertiary">
                        {row.productos}{" "}
                        {row.productos === 1 ? "producto" : "productos"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[13px] text-fg-secondary">
                        {formatDateTime(row.fecha)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[13px]">{row.vendedor}</span>
                    </Td>
                    <Td>
                      <span className="text-[13px]">{row.cliente}</span>
                    </Td>
                    <Td>
                      <span className="text-[13px]">
                        {PAYMENT_METHOD_LABELS[row.metodoPago as PaymentMethod]}
                      </span>
                      <span className="block text-[12px] text-fg-tertiary">
                        {
                          FINANCING_TYPE_LABELS[
                            row.financiacion as keyof typeof FINANCING_TYPE_LABELS
                          ]
                        }
                      </span>
                    </Td>
                    <Td>
                      <Badge tone={row.estado === "ANULADA" ? "danger" : "success"}>
                        {SALE_STATUS_LABELS[row.estado as keyof typeof SALE_STATUS_LABELS]}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <span
                        className={
                          row.estado === "ANULADA"
                            ? "tabular text-fg-tertiary line-through"
                            : "tabular font-medium"
                        }
                      >
                        {formatCurrency(row.total)}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </Card>

      {report.truncated ? <TruncationNote shown={REPORT_PREVIEW_LIMIT} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------

async function MovementsReport({
  filters,
}: {
  filters: Awaited<ReturnType<typeof reportFiltersSchema.parse>>;
}) {
  const report = await getMovementsReport(filters, REPORT_PREVIEW_LIMIT);

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {report.byType.map((row) => (
          <Badge key={row.type} tone="neutral">
            {STOCK_MOVEMENT_LABELS[row.type as StockMovementType]}: {row.count}
          </Badge>
        ))}
      </div>

      <Card className="overflow-hidden">
        {report.rows.length === 0 ? (
          <EmptyState icon={FileBarChart} title="No hay movimientos que coincidan" />
        ) : (
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Tipo</Th>
                  <Th>Producto</Th>
                  <Th align="center">Cant.</Th>
                  <Th>Motivo</Th>
                  <Th>Usuario</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <span className="text-[13px] text-fg-secondary">
                        {formatDateTime(row.fecha)}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[13px] font-medium">
                        {STOCK_MOVEMENT_LABELS[row.tipo as StockMovementType]}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[14px]">{row.producto}</span>
                      {row.identificacion ? (
                        <span className="tabular block text-[12px] text-fg-tertiary">
                          {row.identificacion}
                        </span>
                      ) : null}
                    </Td>
                    <Td align="center">
                      {row.cantidad !== null ? (
                        <span
                          className={
                            row.cantidad > 0
                              ? "tabular font-medium text-success"
                              : "tabular font-medium text-danger"
                          }
                        >
                          {row.cantidad > 0 ? "+" : ""}
                          {row.cantidad}
                        </span>
                      ) : (
                        <span className="text-fg-tertiary">1</span>
                      )}
                    </Td>
                    <Td>
                      <span className="text-[13px] text-fg-secondary">{row.motivo}</span>
                      {row.comprobante ? (
                        <span className="block text-[12px] text-accent">
                          {row.comprobante}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="text-[13px] text-fg-secondary">{row.usuario}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </Card>

      {report.truncated ? <TruncationNote shown={REPORT_PREVIEW_LIMIT} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------

async function SoldProductsReport({
  filters,
}: {
  filters: Awaited<ReturnType<typeof reportFiltersSchema.parse>>;
}) {
  const report = await getSoldProductsReport(filters);
  const maxRevenue = report.rows[0]?.facturacion ?? 0;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Productos distintos" value={String(report.summary.productCount)} />
        <StatCard label="Unidades vendidas" value={String(report.summary.totalUnits)} />
        <StatCard
          label="Facturación"
          value={formatCurrency(report.summary.totalRevenue)}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        {report.rows.length === 0 ? (
          <EmptyState
            icon={FileBarChart}
            title="No hay ventas en el período"
            description="Probá ampliando el rango de fechas."
          />
        ) : (
          <TableWrapper>
            <Table className="min-w-[700px]">
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th align="center">Unidades</Th>
                  <Th align="right">Facturación</Th>
                  <Th>Participación</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <Tr key={`${row.tipo}-${row.producto}`}>
                    <Td>
                      <span className="font-medium">{row.producto}</span>
                      <span className="block text-[12px] text-fg-tertiary">
                        {row.tipo === "ACCESORIO"
                          ? "Accesorio"
                          : DEVICE_TYPE_LABELS[row.tipo as DeviceType]}
                      </span>
                    </Td>
                    <Td align="center">
                      <span className="tabular font-medium">{row.unidades}</span>
                    </Td>
                    <Td align="right">
                      <span className="tabular font-medium">
                        {formatCurrency(row.facturacion)}
                      </span>
                    </Td>
                    <Td>
                      {/* Barra relativa al producto más facturado. */}
                      <span
                        className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle"
                        aria-hidden
                      >
                        <span
                          className="block h-full rounded-full bg-accent"
                          style={{
                            width: `${
                              maxRevenue > 0 ? (row.facturacion / maxRevenue) * 100 : 0
                            }%`,
                          }}
                        />
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------

async function LowStockReport() {
  const report = await getLowStockReport();

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Productos bajo el mínimo"
          value={String(report.summary.count)}
          tone={report.summary.count > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Sin stock"
          value={String(report.summary.outOfStock)}
          tone={report.summary.outOfStock > 0 ? "danger" : "neutral"}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        {report.rows.length === 0 ? (
          <EmptyState
            icon={FileBarChart}
            title="Todo por encima del mínimo"
            description="Ningún producto está por debajo del stock mínimo configurado."
          />
        ) : (
          <TableWrapper>
            <Table className="min-w-[600px]">
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th>Tipo</Th>
                  <Th align="center">Disponible</Th>
                  <Th align="center">Mínimo</Th>
                  <Th align="center">Faltante</Th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <Tr key={`${row.tipo}-${row.producto}`}>
                    <Td>
                      <span className="font-medium">{row.producto}</span>
                    </Td>
                    <Td>
                      <Badge tone="neutral">
                        {row.tipo === "ACCESORIO" ? "Accesorio" : "Equipo"}
                      </Badge>
                    </Td>
                    <Td align="center">
                      <span
                        className={
                          row.disponible === 0
                            ? "tabular font-semibold text-danger"
                            : "tabular font-semibold text-warning"
                        }
                      >
                        {row.disponible}
                      </span>
                    </Td>
                    <Td align="center">
                      <span className="tabular text-fg-secondary">{row.minimo}</span>
                    </Td>
                    <Td align="center">
                      <span className="tabular font-medium">{row.faltante}</span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </Card>
    </>
  );
}
