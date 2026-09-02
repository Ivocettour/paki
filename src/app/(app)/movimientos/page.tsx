import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { reportFiltersSchema } from "@/lib/validations/report";
import { getMovementsReport, REPORT_PREVIEW_LIMIT } from "@/lib/services/reports";
import { getReportFilterOptions } from "@/lib/services/reports";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import { STOCK_MOVEMENT_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { MovementFilters } from "./filters";
import type { StockMovementType } from "@prisma/client";

export const metadata = { title: "Movimientos" };

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!can(user?.role, "stock.ver_movimientos")) redirect("/");

  const params = await searchParams;
  const parsed = reportFiltersSchema.safeParse({ ...params, type: "movimientos" });
  const filters = parsed.success
    ? parsed.data
    : reportFiltersSchema.parse({ type: "movimientos" });

  const [report, options] = await Promise.all([
    getMovementsReport(filters, REPORT_PREVIEW_LIMIT),
    getReportFilterOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Movimientos de stock"
        description="Todo lo que entró, salió o se ajustó. Los movimientos no se eliminan."
      />

      <MovementFilters users={options.users} brands={options.brands} />

      {report.byType.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {report.byType.map((row) => (
            <Badge key={row.type} tone="neutral">
              {STOCK_MOVEMENT_LABELS[row.type as StockMovementType]}: {row.count}
            </Badge>
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {report.rows.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No hay movimientos que coincidan"
            description="Los ingresos, ventas, ajustes y bajas quedan registrados acá."
          />
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
                      <Badge
                        tone={
                          row.tipo === "VENTA" || row.tipo === "AJUSTE_NEGATIVO"
                            ? "warning"
                            : row.tipo === "BAJA"
                              ? "danger"
                              : "success"
                        }
                      >
                        {STOCK_MOVEMENT_LABELS[row.tipo as StockMovementType]}
                      </Badge>
                    </Td>
                    <Td>
                      {row.deviceId ? (
                        <Link
                          href={`/inventario/${row.deviceId}`}
                          className="text-[14px] hover:text-accent"
                        >
                          {row.producto}
                        </Link>
                      ) : (
                        <span className="text-[14px]">{row.producto}</span>
                      )}
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
                        <span className="tabular text-fg-tertiary">1</span>
                      )}
                    </Td>
                    <Td>
                      <span className="text-[13px] text-fg-secondary">{row.motivo}</span>
                      {row.saleId ? (
                        <Link
                          href={`/ventas/${row.saleId}`}
                          className="block text-[12px] text-accent hover:underline"
                        >
                          {row.comprobante}
                        </Link>
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

      <p className="mt-4 text-[13px] text-fg-tertiary">
        {report.truncated
          ? `Se muestran los ${REPORT_PREVIEW_LIMIT} movimientos más recientes de ${report.total}. Usá los filtros o exportá desde Reportes.`
          : `${report.total} ${report.total === 1 ? "movimiento" : "movimientos"}`}
      </p>
    </>
  );
}
