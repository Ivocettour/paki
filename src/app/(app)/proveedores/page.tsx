import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { supplierFiltersSchema } from "@/lib/validations/supplier";
import { listSuppliers } from "@/lib/services/suppliers";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { NewSupplierButton, SupplierRowActions, SupplierSearch } from "./supplier-ui";

export const metadata = { title: "Proveedores" };

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!can(user?.role, "proveedores.ver")) redirect("/");

  const params = await searchParams;
  const parsed = supplierFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : supplierFiltersSchema.parse({});

  const suppliers = await listSuppliers(filters);
  const canManage = can(user?.role, "proveedores.gestionar");

  return (
    <>
      <PageHeader
        title="Proveedores"
        description="A quién le comprás. Los proveedores se eligen al registrar una compra."
        action={canManage ? <NewSupplierButton /> : null}
      />

      <div className="mb-5">
        <SupplierSearch />
      </div>

      <Card className="overflow-hidden">
        {suppliers.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No hay proveedores"
            description="Cargá tus proveedores para poder registrar compras."
            action={canManage ? <NewSupplierButton /> : null}
          />
        ) : (
          <TableWrapper>
            <Table className="min-w-[840px]">
              <thead>
                <tr>
                  <Th>Proveedor</Th>
                  <Th>CUIT</Th>
                  <Th>Contacto</Th>
                  <Th align="center">Compras</Th>
                  <Th align="right">Total comprado</Th>
                  <Th align="right">
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => (
                  <Tr key={supplier.id}>
                    <Td>
                      <span className="font-medium">{supplier.name}</span>
                      {supplier.address ? (
                        <span className="block text-[12px] text-fg-tertiary">
                          {supplier.address}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <span className="tabular text-[13px] text-fg-secondary">
                        {supplier.cuit ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <span className="text-[13px] text-fg-secondary">
                        {supplier.phone ?? "—"}
                      </span>
                      {supplier.email ? (
                        <span className="block text-[12px] text-fg-tertiary">
                          {supplier.email}
                        </span>
                      ) : null}
                    </Td>
                    <Td align="center">
                      <span className="tabular text-[13px]">{supplier.purchaseCount}</span>
                    </Td>
                    <Td align="right">
                      <span className="tabular font-medium">
                        {formatCurrency(supplier.totalPurchased)}
                      </span>
                      <span className="block text-[12px] text-fg-tertiary">
                        compras confirmadas
                      </span>
                    </Td>
                    <Td align="right">
                      {canManage ? (
                        <SupplierRowActions
                          supplier={{
                            id: supplier.id,
                            name: supplier.name,
                            cuit: supplier.cuit,
                            phone: supplier.phone,
                            email: supplier.email,
                            address: supplier.address,
                          }}
                        />
                      ) : null}
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
