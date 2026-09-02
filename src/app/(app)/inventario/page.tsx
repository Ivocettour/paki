import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { deviceFiltersSchema } from "@/lib/validations/device";
import { getCatalog, listDevices } from "@/lib/services/devices";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import { BatteryIndicator } from "@/components/ui/badge";
import { ConditionBadge, InventoryStatusBadge } from "@/components/ui/status";
import { formatStorage } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { InventoryFilters } from "./filters";
import { DeviceRowActions } from "./row-actions";

export const metadata = { title: "Inventario" };

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  // Los filtros inválidos de la URL se descartan en lugar de romper la página.
  const parsed = deviceFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : deviceFiltersSchema.parse({});

  const [result, catalog, user] = await Promise.all([
    listDevices(filters),
    getCatalog(),
    getCurrentUser(),
  ]);

  const canCreate = can(user?.role, "inventario.crear");
  const canEdit = can(user?.role, "inventario.editar");
  const canDeactivate = can(user?.role, "inventario.dar_de_baja");

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Cada equipo se gestiona como una unidad individual."
        action={
          canCreate ? (
            <Link href="/inventario/nuevo">
              <Button>
                <Plus className="size-4" aria-hidden />
                Registrar equipo
              </Button>
            </Link>
          ) : null
        }
      />

      <InventoryFilters catalog={catalog} />

      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No se encontraron equipos"
            description={
              result.total === 0
                ? "Todavía no hay equipos cargados en el inventario."
                : "Probá ajustando la búsqueda o los filtros aplicados."
            }
            action={
              canCreate && result.total === 0 ? (
                <Link href="/inventario/nuevo">
                  <Button>
                    <Plus className="size-4" aria-hidden />
                    Registrar el primer equipo
                  </Button>
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    <Th>Equipo</Th>
                    <Th>Estado</Th>
                    <Th>Batería</Th>
                    <Th>IMEI</Th>
                    {result.canSeePurchasePrice ? <Th align="right">Compra</Th> : null}
                    <Th align="right">Precio</Th>
                    <Th>Inventario</Th>
                    <Th>Ingreso</Th>
                    <Th align="right">
                      <span className="sr-only">Acciones</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((device) => (
                    <Tr key={device.id}>
                      <Td>
                        <Link
                          href={`/inventario/${device.id}`}
                          className="block hover:text-accent"
                        >
                          <span className="font-medium">
                            {device.brandName} {device.modelName}
                          </span>
                          <span className="block text-[12px] text-fg-tertiary">
                            {device.color} · {formatStorage(device.storageGb)}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <ConditionBadge condition={device.condition} />
                      </Td>
                      <Td>
                        <BatteryIndicator percent={device.batteryPercent} />
                      </Td>
                      <Td>
                        <span className="tabular text-[13px] text-fg-secondary">
                          {device.imei ?? "—"}
                        </span>
                      </Td>
                      {result.canSeePurchasePrice ? (
                        <Td align="right">
                          <span className="tabular text-[13px] text-fg-secondary">
                            {device.purchasePrice === null
                              ? "—"
                              : formatCurrency(device.purchasePrice)}
                          </span>
                        </Td>
                      ) : null}
                      <Td align="right">
                        <span className="tabular font-medium">
                          {formatCurrency(device.salePrice)}
                        </span>
                      </Td>
                      <Td>
                        <InventoryStatusBadge status={device.inventoryStatus} />
                      </Td>
                      <Td>
                        <span className="text-[13px] text-fg-secondary">
                          {formatDate(device.entryDate)}
                        </span>
                      </Td>
                      <Td align="right">
                        <DeviceRowActions
                          deviceId={device.id}
                          deviceLabel={`${device.brandName} ${device.modelName}`}
                          inventoryStatus={device.inventoryStatus}
                          canEdit={canEdit}
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
              basePath="/inventario"
            />
          </>
        )}
      </Card>
    </>
  );
}
