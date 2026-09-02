import Link from "next/link";
import { UsersRound } from "lucide-react";
import { customerFiltersSchema } from "@/lib/validations/customer";
import { listCustomers } from "@/lib/services/customers";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { CustomerSearchBar, NewCustomerButton } from "./client-actions";

export const metadata = { title: "Clientes" };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = customerFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : customerFiltersSchema.parse({});

  const [result, user] = await Promise.all([listCustomers(filters), getCurrentUser()]);
  const canCreate = can(user?.role, "clientes.crear");

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Los datos del cliente son opcionales al registrar una venta."
        action={canCreate ? <NewCustomerButton /> : null}
      />

      <div className="mb-5">
        <CustomerSearchBar />
      </div>

      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No se encontraron clientes"
            description={
              result.total === 0
                ? "Todavía no hay clientes cargados."
                : "Probá ajustando la búsqueda."
            }
            action={canCreate && result.total === 0 ? <NewCustomerButton /> : null}
          />
        ) : (
          <>
            <TableWrapper>
              <Table>
                <thead>
                  <tr>
                    <Th>Cliente</Th>
                    <Th>DNI</Th>
                    <Th>Teléfono</Th>
                    <Th>Email</Th>
                    <Th align="center">Compras</Th>
                    <Th>Alta</Th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((customer) => (
                    <Tr key={customer.id}>
                      <Td>
                        <Link
                          href={`/clientes/${customer.id}`}
                          className="font-medium hover:text-accent"
                        >
                          {customer.lastName}, {customer.firstName}
                        </Link>
                      </Td>
                      <Td>
                        <span className="tabular text-[13px] text-fg-secondary">
                          {customer.dni ?? "—"}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[13px] text-fg-secondary">
                          {customer.phone ?? "—"}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[13px] text-fg-secondary">
                          {customer.email ?? "—"}
                        </span>
                      </Td>
                      <Td align="center">
                        <span className="tabular text-[13px]">{customer.saleCount}</span>
                      </Td>
                      <Td>
                        <span className="text-[13px] text-fg-secondary">
                          {formatDate(customer.createdAt)}
                        </span>
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
              basePath="/clientes"
            />
          </>
        )}
      </Card>
    </>
  );
}
