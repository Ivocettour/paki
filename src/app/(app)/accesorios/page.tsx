import { Headphones } from "lucide-react";
import { accessoryFiltersSchema } from "@/lib/validations/accessory";
import { listAccessories } from "@/lib/services/accessories";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import { ACCESSORY_CATEGORY_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { AccessoryFilters, NewAccessoryButton, AccessoryRowActions } from "./accessory-ui";

export const metadata = { title: "Accesorios" };

export default async function AccesoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = accessoryFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : accessoryFiltersSchema.parse({});

  const [result, user] = await Promise.all([listAccessories(filters), getCurrentUser()]);

  const canCreate = can(user?.role, "inventario.crear");
  const canEdit = can(user?.role, "inventario.editar");
  const canAdjust = can(user?.role, "stock.ajustar");
  const canDeactivate = can(user?.role, "inventario.dar_de_baja");

  return (
    <>
      <PageHeader
        title="Accesorios"
        description="Productos que se manejan por cantidad, no por unidad individual."
        action={canCreate ? <NewAccessoryButton /> : null}
      />

      <AccessoryFilters />

      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Headphones}
            title="No se encontraron accesorios"
            description={
              result.total === 0
                ? "Cargá fundas, templados, cargadores y demás productos que vendas por cantidad."
                : "Probá ajustando la búsqueda o los filtros."
            }
            action={canCreate && result.total === 0 ? <NewAccessoryButton /> : null}
          />
        ) : (
          <>
            <TableWrapper>
              <Table className="min-w-[820px]">
                <thead>
                  <tr>
                    <Th>Producto</Th>
                    <Th>Rubro</Th>
                    <Th align="right">Precio</Th>
                    <Th align="center">Stock</Th>
                    <Th align="center">Mínimo</Th>
                    <Th>Estado</Th>
                    <Th align="right">
                      <span className="sr-only">Acciones</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((accessory) => (
                    <Tr key={accessory.id}>
                      <Td>
                        <span className="font-medium">{accessory.name}</span>
                        <span className="block text-[12px] text-fg-tertiary">
                          {[accessory.brand, accessory.sku && `Cód. ${accessory.sku}`]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[13px] text-fg-secondary">
                          {ACCESSORY_CATEGORY_LABELS[accessory.category]}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="tabular font-medium">
                          {formatCurrency(accessory.salePrice)}
                        </span>
                      </Td>
                      <Td align="center">
                        <span
                          className={
                            accessory.isLowStock
                              ? "tabular font-semibold text-warning"
                              : accessory.stockQuantity === 0
                                ? "tabular text-danger"
                                : "tabular font-medium"
                          }
                        >
                          {accessory.stockQuantity}
                        </span>
                      </Td>
                      <Td align="center">
                        <span className="tabular text-[13px] text-fg-tertiary">
                          {accessory.minStock > 0 ? accessory.minStock : "—"}
                        </span>
                      </Td>
                      <Td>
                        {!accessory.isActive ? (
                          <Badge tone="danger">Dado de baja</Badge>
                        ) : accessory.stockQuantity === 0 ? (
                          <Badge tone="danger">Sin stock</Badge>
                        ) : accessory.isLowStock ? (
                          <Badge tone="warning">Stock bajo</Badge>
                        ) : (
                          <Badge tone="success">Disponible</Badge>
                        )}
                      </Td>
                      <Td align="right">
                        <AccessoryRowActions
                          accessory={{
                            id: accessory.id,
                            category: accessory.category,
                            name: accessory.name,
                            brand: accessory.brand,
                            sku: accessory.sku,
                            salePrice: accessory.salePrice,
                            minStock: accessory.minStock,
                            stockQuantity: accessory.stockQuantity,
                            isActive: accessory.isActive,
                          }}
                          canEdit={canEdit}
                          canAdjust={canAdjust}
                          canDeactivate={canDeactivate}
                        />
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
              basePath="/accesorios"
            />
          </>
        )}
      </Card>
    </>
  );
}
