import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, Wallet } from "lucide-react";
import {
  getInstallments,
  getInstallmentsSummary,
  type InstallmentFilter,
} from "@/lib/services/installments";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import { formatBusinessDate, formatCurrency, formatDate } from "@/lib/utils";
import { INSTALLMENT_DISPLAY_LABELS } from "@/lib/constants";
import { InstallmentActions } from "./installment-actions";
import { FilterTabs } from "./filter-tabs";

export const metadata = { title: "Cuotas" };

const VALID_FILTERS: InstallmentFilter[] = [
  "vencidas",
  "proximas",
  "pendientes",
  "pagadas",
  "todas",
];

export default async function CuotasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const filter: InstallmentFilter = VALID_FILTERS.includes(estado as InstallmentFilter)
    ? (estado as InstallmentFilter)
    : "vencidas";

  const [summary, installments, user] = await Promise.all([
    getInstallmentsSummary(),
    getInstallments(filter),
    getCurrentUser(),
  ]);

  const canRegister = can(user?.role, "cuotas.registrar_pago");
  const canCancel = can(user?.role, "cuotas.anular_pago");

  return (
    <>
      <PageHeader
        title="Cuotas"
        description="Cuotas a cobrar de ventas financiadas por el local."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Vencidas"
          value={formatCurrency(summary.overdueAmount)}
          icon={AlertTriangle}
          tone={summary.overdueCount > 0 ? "danger" : "neutral"}
          hint={`${summary.overdueCount} ${
            summary.overdueCount === 1 ? "cuota vencida" : "cuotas vencidas"
          }`}
        />
        <StatCard
          label="Vencen en 7 días"
          value={formatCurrency(summary.dueSoonAmount)}
          icon={CalendarClock}
          tone={summary.dueSoonCount > 0 ? "warning" : "neutral"}
          hint={`${summary.dueSoonCount} ${
            summary.dueSoonCount === 1 ? "cuota próxima" : "cuotas próximas"
          }`}
        />
        <StatCard
          label="Total por cobrar"
          value={formatCurrency(summary.pendingAmount)}
          icon={Wallet}
          hint={`${summary.pendingCount} ${
            summary.pendingCount === 1 ? "cuota pendiente" : "cuotas pendientes"
          }`}
        />
      </div>

      <div className="mt-6">
        <FilterTabs active={filter} summary={summary} />
      </div>

      <Card className="mt-4 overflow-hidden">
        {installments.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={
              filter === "vencidas"
                ? "No hay cuotas vencidas"
                : "No hay cuotas para mostrar"
            }
            description={
              filter === "vencidas"
                ? "Todos los clientes están al día con sus pagos."
                : "Las ventas financiadas por el local generan cuotas que aparecen acá."
            }
          />
        ) : (
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th>Venta</Th>
                  <Th>Cuota</Th>
                  <Th>Vencimiento</Th>
                  <Th align="right">Monto</Th>
                  <Th>Estado</Th>
                  <Th align="right">
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {installments.map((installment) => (
                  <Tr key={installment.id}>
                    <Td>
                      <span className="font-medium">
                        {installment.customerName ?? "Consumidor final"}
                      </span>
                      {installment.customerPhone ? (
                        <span className="block text-[12px] text-fg-tertiary">
                          {installment.customerPhone}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Link
                        href={`/ventas/${installment.saleId}`}
                        className="text-accent hover:underline"
                      >
                        {installment.saleNumber}
                      </Link>
                    </Td>
                    <Td>
                      <span className="tabular text-[13px] text-fg-secondary">
                        {installment.number} de {installment.totalInstallments}
                      </span>
                    </Td>
                    <Td>
                      <span className="tabular text-[13px]">
                        {formatBusinessDate(installment.dueDate)}
                      </span>
                      {installment.daysOverdue > 0 ? (
                        <span className="block text-[12px] text-danger">
                          {installment.daysOverdue}{" "}
                          {installment.daysOverdue === 1 ? "día" : "días"} de atraso
                        </span>
                      ) : null}
                    </Td>
                    <Td align="right">
                      <span className="tabular font-medium">
                        {formatCurrency(installment.amount)}
                      </span>
                      {installment.paidAmount !== null &&
                      installment.paidAmount !== installment.amount ? (
                        <span className="block text-[12px] text-fg-tertiary">
                          cobrado {formatCurrency(installment.paidAmount)}
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          installment.displayStatus === "VENCIDA"
                            ? "danger"
                            : installment.displayStatus === "PAGADA"
                              ? "success"
                              : installment.displayStatus === "ANULADA"
                                ? "neutral"
                                : "warning"
                        }
                      >
                        {INSTALLMENT_DISPLAY_LABELS[installment.displayStatus]}
                      </Badge>
                      {installment.paidAt ? (
                        <span className="block text-[12px] text-fg-tertiary">
                          {formatDate(installment.paidAt)}
                        </span>
                      ) : null}
                    </Td>
                    <Td align="right">
                      <InstallmentActions
                        installmentId={installment.id}
                        amount={installment.amount}
                        label={`cuota ${installment.number} de ${installment.saleNumber}`}
                        status={installment.status}
                        canRegister={canRegister}
                        canCancel={canCancel}
                      />
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
