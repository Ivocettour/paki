import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { getCustomerDetail } from "@/lib/services/customers";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { FINANCING_TYPE_LABELS, SALE_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { EditCustomerButton } from "../client-actions";

export const metadata = { title: "Detalle del cliente" };

export default async function DetalleClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let customer;
  try {
    customer = await getCustomerDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NO_ENCONTRADO") notFound();
    throw error;
  }

  const user = await getCurrentUser();
  const canEdit = can(user?.role, "clientes.editar");

  return (
    <>
      <Link
        href="/clientes"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a clientes
      </Link>

      <PageHeader
        title={customer.fullName}
        description={
          [customer.dni && `DNI ${customer.dni}`, customer.phone, customer.email]
            .filter(Boolean)
            .join(" · ") || "Sin datos de contacto"
        }
        action={
          canEdit ? (
            <EditCustomerButton
              customer={{
                id: customer.id,
                firstName: customer.firstName,
                lastName: customer.lastName,
                dni: customer.dni,
                phone: customer.phone,
                email: customer.email,
                notes: customer.notes,
              }}
            />
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Compras realizadas"
          value={String(customer.purchaseCount)}
          hint="Sin contar ventas anuladas"
        />
        <StatCard
          label="Total comprado"
          value={formatCurrency(customer.totalPurchased)}
          hint="Sin contar ventas anuladas"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Historial de compras" />
          {customer.sales.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Todavía no compró nada"
              description="Las ventas asociadas a este cliente van a aparecer acá."
            />
          ) : (
            <ul className="divide-y divide-line-subtle">
              {customer.sales.map((sale) => (
                <li key={sale.id} className="px-5 py-3.5">
                  <Link href={`/ventas/${sale.id}`} className="group block">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[14px] font-medium text-fg group-hover:text-accent">
                          {sale.saleNumber}
                        </p>
                        <p className="text-[12px] text-fg-tertiary">
                          {formatDate(sale.saleDate)} · {sale.itemCount}{" "}
                          {sale.itemCount === 1 ? "equipo" : "equipos"} · {sale.sellerName}
                        </p>
                        <p className="mt-1 text-[12px] text-fg-tertiary">
                          {FINANCING_TYPE_LABELS[sale.financingType]}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={
                            sale.status === "ANULADA"
                              ? "tabular text-[14px] text-fg-tertiary line-through"
                              : "tabular text-[14px] font-medium text-fg"
                          }
                        >
                          {formatCurrency(sale.total)}
                        </p>
                        <Badge tone={sale.status === "ANULADA" ? "danger" : "success"}>
                          {SALE_STATUS_LABELS[sale.status]}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Datos" />
          <CardBody className="space-y-3 text-[13px]">
            <DataRow label="DNI" value={customer.dni ?? "—"} />
            <DataRow label="Teléfono" value={customer.phone ?? "—"} />
            <DataRow label="Email" value={customer.email ?? "—"} />
            <DataRow label="Alta" value={formatDateTime(customer.createdAt)} />
            <DataRow label="Registrado por" value={customer.createdByName} />
            {customer.notes ? <DataRow label="Observaciones" value={customer.notes} /> : null}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-fg-secondary">{label}</p>
      <p className="text-[14px] text-fg">{value}</p>
    </div>
  );
}
