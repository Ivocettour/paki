import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Truck } from "lucide-react";
import { purchaseFiltersSchema } from "@/lib/validations/purchase";
import { listPurchases } from "@/lib/services/purchases";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import { PURCHASE_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PurchaseFilters } from "./filters";

export const metadata = { title: "Compras" };

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!can(user?.role, "compras.ver")) redirect("/");

  const params = await searchParams;
  const parsed = purchaseFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : purchaseFiltersSchema.parse({});

  const result = await listPurchases(filters);
  const canManage = can(user?.role, "compras.gestionar");

  return (
    <>
      <PageHeader
        title="Compras"
        description="Al confirmar una compra, su mercadería ingresa al inventario automáticamente."
        action={
          canManage ? (
            <Link href="/compras/nueva">
              <Button>
                <Plus className="size-4" aria-hidden />
                Registrar compra
              </Button>
            </Link>
          ) : null
        }
      />

      <PurchaseFilters />

      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No se encontraron compras"
            description={
              result.total === 0
                ? "Registrá una compra para ingresar mercadería al inventario."
                : "Probá ajustando la búsqueda o los filtros."
            }
            action={
              canManage && result.total === 0 ? (
                <Link href="/compras/nueva">
                  <Button>
                    <Plus className="size-4" aria-hidden />
                    Registrar la primera compra
                  </Button>
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-line-subtle px-5 py-3">
              <p className="text-[13px] text-fg-secondary">
                Total comprado{" "}
                <span className="text-fg-tertiary">(solo compras confirmadas)</span>
              </p>
              <p className="tabular text-[15px] font-semibold text-fg">
                {formatCurrency(result.confirmedTotal)}
              </p>
            </div>

            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    <Th>Comprobante</Th>
                    <Th>Fecha</Th>
                    <Th>Proveedor</Th>
                    <Th>Registró</Th>
                    <Th align="right">Total</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((purchase) => (
                    <Tr key={purchase.id}>
                      <Td>
                        <Link
                          href={`/compras/${purchase.id}`}
                          className="font-medium hover:text-accent"
                        >
                          {purchase.purchaseNumber}
                        </Link>
                        <span className="block text-[12px] text-fg-tertiary">
                          {purchase.itemCount}{" "}
                          {purchase.itemCount === 1 ? "ítem" : "ítems"}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[13px] text-fg-secondary">
                          {formatDate(purchase.purchaseDate)}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[14px]">{purchase.supplierName}</span>
                      </Td>
                      <Td>
                        <span className="text-[13px] text-fg-secondary">
                          {purchase.userName}
                        </span>
                      </Td>
                      <Td align="right">
                        <span
                          className={
                            purchase.status === "ANULADA"
                              ? "tabular text-fg-tertiary line-through"
                              : "tabular font-medium"
                          }
                        >
                          {formatCurrency(purchase.total)}
                        </span>
                      </Td>
                      <Td>
                        <Badge
                          tone={
                            purchase.status === "CONFIRMADA"
                              ? "success"
                              : purchase.status === "ANULADA"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {PURCHASE_STATUS_LABELS[purchase.status]}
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
              basePath="/compras"
            />
          </>
        )}
      </Card>
    </>
  );
}
