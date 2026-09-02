import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { saleFiltersSchema } from "@/lib/validations/sale";
import { listSales } from "@/lib/services/sales";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import {
  FINANCING_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
} from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { SaleFilters } from "./filters";
import type { PaymentMethod } from "@prisma/client";

export const metadata = { title: "Ventas" };

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = saleFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : saleFiltersSchema.parse({});

  const [result, user] = await Promise.all([listSales(filters), getCurrentUser()]);
  const canRegister = can(user?.role, "ventas.registrar");

  return (
    <>
      <PageHeader
        title="Ventas"
        description={
          result.seesAll ? "Todas las ventas del local." : "Las ventas que registraste."
        }
        action={
          canRegister ? (
            <Link href="/ventas/nueva">
              <Button>
                <Plus className="size-4" aria-hidden />
                Registrar venta
              </Button>
            </Link>
          ) : null
        }
      />

      <SaleFilters seesAll={result.seesAll} />

      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No se encontraron ventas"
            description={
              result.total === 0
                ? "Todavía no hay ventas registradas."
                : "Probá ajustando la búsqueda o los filtros."
            }
            action={
              canRegister && result.total === 0 ? (
                <Link href="/ventas/nueva">
                  <Button>
                    <Plus className="size-4" aria-hidden />
                    Registrar la primera venta
                  </Button>
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-line-subtle px-5 py-3">
              <p className="text-[13px] text-fg-secondary">
                Total facturado{" "}
                <span className="text-fg-tertiary">(sin ventas anuladas)</span>
              </p>
              <p className="tabular text-[15px] font-semibold text-fg">
                {formatCurrency(result.amountTotal)}
              </p>
            </div>

            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    <Th>Comprobante</Th>
                    <Th>Fecha</Th>
                    <Th>Cliente</Th>
                    {result.seesAll ? <Th>Vendedor</Th> : null}
                    <Th>Pago</Th>
                    <Th align="right">Total</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((sale) => (
                    <Tr key={sale.id}>
                      <Td>
                        <Link
                          href={`/ventas/${sale.id}`}
                          className="font-medium hover:text-accent"
                        >
                          {sale.saleNumber}
                        </Link>
                        <span className="block text-[12px] text-fg-tertiary">
                          {sale.itemCount} {sale.itemCount === 1 ? "equipo" : "equipos"}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[13px] text-fg-secondary">
                          {formatDateTime(sale.saleDate)}
                        </span>
                      </Td>
                      <Td>{sale.customerName ?? <span className="text-fg-tertiary">Consumidor final</span>}</Td>
                      {result.seesAll ? (
                        <Td>
                          <span className="text-[13px] text-fg-secondary">
                            {sale.sellerName}
                          </span>
                        </Td>
                      ) : null}
                      <Td>
                        <span className="text-[13px]">
                          {PAYMENT_METHOD_LABELS[sale.paymentMethod as PaymentMethod]}
                        </span>
                        {sale.installmentCount ? (
                          <span className="block text-[12px] text-fg-tertiary">
                            {sale.installmentCount} cuotas ·{" "}
                            {sale.financingType === "FINANCIACION_LOCAL"
                              ? "del local"
                              : "con tarjeta"}
                          </span>
                        ) : (
                          <span className="block text-[12px] text-fg-tertiary">
                            {FINANCING_TYPE_LABELS[sale.financingType]}
                          </span>
                        )}
                      </Td>
                      <Td align="right">
                        <span
                          className={
                            sale.status === "ANULADA"
                              ? "tabular text-fg-tertiary line-through"
                              : "tabular font-medium"
                          }
                        >
                          {formatCurrency(sale.total)}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={sale.status === "ANULADA" ? "danger" : "success"}>
                          {SALE_STATUS_LABELS[sale.status]}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrapper>

            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              basePath="/ventas"
            />
          </>
        )}
      </Card>
    </>
  );
}
