import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSaleDetail } from "@/lib/services/sales";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge, BatteryIndicator } from "@/components/ui/badge";
import { ConditionBadge, InventoryStatusBadge } from "@/components/ui/status";
import {
  ACCESSORY_CATEGORY_LABELS,
  DEVICE_TYPE_LABELS,
  FINANCING_TYPE_LABELS,
  INSTALLMENT_DISPLAY_LABELS,
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
  formatStorage,
} from "@/lib/constants";
import { resolveDisplayStatus } from "@/lib/domain/installments";
import { formatBusinessDate, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { CancelSaleButton } from "./cancel-sale";
import type { PaymentMethod } from "@prisma/client";

export const metadata = { title: "Detalle de la venta" };

export default async function DetalleVentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let sale;
  try {
    sale = await getSaleDetail(id);
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "NO_ENCONTRADO") notFound();
      // Un vendedor que intenta abrir la venta de otro vuelve al listado.
      if (error.code === "SIN_PERMISOS") redirect("/ventas");
    }
    throw error;
  }

  const user = await getCurrentUser();
  const canCancel = can(user?.role, "ventas.anular");
  const isCancelled = sale.status === "ANULADA";
  const hasPaidInstallments = sale.installments.some(
    (installment) => installment.status === "PAGADA",
  );

  return (
    <>
      <Link
        href="/ventas"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a ventas
      </Link>

      <PageHeader
        title={sale.saleNumber}
        description={`${formatDateTime(sale.saleDate)} · ${sale.sellerName}`}
        action={
          canCancel && !isCancelled ? (
            <CancelSaleButton
              saleId={sale.id}
              saleNumber={sale.saleNumber}
              deviceCount={sale.items.length}
              hasPaidInstallments={hasPaidInstallments}
            />
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={isCancelled ? "danger" : "success"}>
          {SALE_STATUS_LABELS[sale.status]}
        </Badge>
        <Badge tone="neutral">
          {PAYMENT_METHOD_LABELS[sale.paymentMethod as PaymentMethod]}
        </Badge>
        <Badge tone={sale.financingType === "FINANCIACION_LOCAL" ? "warning" : "neutral"}>
          {FINANCING_TYPE_LABELS[sale.financingType]}
          {sale.installmentCount ? ` · ${sale.installmentCount} cuotas` : ""}
        </Badge>
      </div>

      {isCancelled ? (
        <Card className="mb-4 border-danger/30 bg-danger-soft">
          <CardBody>
            <p className="text-[14px] font-medium text-danger">Venta anulada</p>
            <p className="mt-1 text-[13px] text-fg-secondary">
              {sale.cancelledByName} · {sale.cancelledAt ? formatDateTime(sale.cancelledAt) : ""}
            </p>
            <p className="mt-2 text-[14px] text-fg">{sale.cancellationReason}</p>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Productos vendidos"
              description={`${sale.items.length} ${
                sale.items.length === 1 ? "línea" : "líneas"
              }`}
            />
            <ul className="divide-y divide-line-subtle">
              {sale.items.map((item) => (
                <li key={item.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {item.device ? (
                        <>
                          <Link
                            href={`/inventario/${item.device.id}`}
                            className="text-[14px] font-medium text-fg hover:text-accent"
                          >
                            {item.device.brandName} {item.device.modelName}
                          </Link>
                          <p className="text-[12px] text-fg-tertiary">
                            {item.device.color}
                            {item.device.storageGb
                              ? ` · ${formatStorage(item.device.storageGb)}`
                              : ""}
                            {item.device.imei ? ` · IMEI ${item.device.imei}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge tone="neutral">
                              {DEVICE_TYPE_LABELS[item.device.type]}
                            </Badge>
                            <ConditionBadge condition={item.device.condition} />
                            {item.device.batteryPercent !== null ? (
                              <BatteryIndicator percent={item.device.batteryPercent} />
                            ) : null}
                            <InventoryStatusBadge status={item.device.inventoryStatus} />
                          </div>
                        </>
                      ) : item.accessory ? (
                        <>
                          <Link
                            href={`/accesorios/${item.accessory.id}`}
                            className="text-[14px] font-medium text-fg hover:text-accent"
                          >
                            {item.accessory.name}
                          </Link>
                          <p className="text-[12px] text-fg-tertiary">
                            {ACCESSORY_CATEGORY_LABELS[item.accessory.category]}
                            {item.accessory.brand ? ` · ${item.accessory.brand}` : ""}
                          </p>
                          <div className="mt-2">
                            <Badge tone="accent">
                              {item.quantity}{" "}
                              {item.quantity === 1 ? "unidad" : "unidades"} ×{" "}
                              {formatCurrency(item.unitPrice)}
                            </Badge>
                          </div>
                        </>
                      ) : null}
                    </div>
                    <span className="tabular shrink-0 text-[15px] font-medium">
                      {formatCurrency(item.lineTotal)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {sale.installments.length > 0 ? (
            <Card>
              <CardHeader
                title="Plan de cuotas"
                description={
                  sale.financingType === "FINANCIACION_LOCAL"
                    ? "Financiadas por el local: el cliente debe estas cuotas."
                    : "Cuotas con tarjeta."
                }
                action={
                  <Link
                    href="/cuotas"
                    className="text-[13px] font-medium text-accent hover:underline"
                  >
                    Ir a cuotas
                  </Link>
                }
              />
              <ul className="divide-y divide-line-subtle">
                {sale.installments.map((installment) => {
                  const { displayStatus, daysOverdue } = resolveDisplayStatus(
                    installment.status,
                    installment.dueDate,
                  );

                  return (
                    <li
                      key={installment.id}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <div>
                        <p className="text-[14px] text-fg">
                          Cuota {installment.number} de {sale.installmentCount}
                        </p>
                        <p className="text-[12px] text-fg-tertiary">
                          Vence {formatBusinessDate(installment.dueDate)}
                          {daysOverdue > 0 ? (
                            <span className="text-danger">
                              {" "}
                              · {daysOverdue} {daysOverdue === 1 ? "día" : "días"} de atraso
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular text-[14px] font-medium">
                          {formatCurrency(installment.amount)}
                        </span>
                        <Badge
                          tone={
                            displayStatus === "VENCIDA"
                              ? "danger"
                              : displayStatus === "PAGADA"
                                ? "success"
                                : displayStatus === "ANULADA"
                                  ? "neutral"
                                  : "warning"
                          }
                        >
                          {INSTALLMENT_DISPLAY_LABELS[displayStatus]}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {sale.notes ? (
            <Card>
              <CardHeader title="Observaciones" />
              <CardBody>
                <p className="text-[14px] text-fg">{sale.notes}</p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Totales" />
            <CardBody className="space-y-2.5">
              <div className="flex justify-between text-[14px] text-fg-secondary">
                <span>Subtotal</span>
                <span className="tabular">{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 ? (
                <div className="flex justify-between text-[14px] text-fg-secondary">
                  <span>Descuento</span>
                  <span className="tabular">−{formatCurrency(sale.discount)}</span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t border-line-subtle pt-3">
                <span className="text-[15px] font-medium">Total</span>
                <span className="tabular text-[24px] font-semibold tracking-[-0.03em]">
                  {formatCurrency(sale.total)}
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Cliente" />
            <CardBody>
              {sale.customer ? (
                <>
                  <Link
                    href={`/clientes/${sale.customer.id}`}
                    className="text-[15px] font-medium text-fg hover:text-accent"
                  >
                    {sale.customer.firstName} {sale.customer.lastName}
                  </Link>
                  <div className="mt-2 space-y-1 text-[13px] text-fg-secondary">
                    {sale.customer.dni ? <p>DNI {sale.customer.dni}</p> : null}
                    {sale.customer.phone ? <p>{sale.customer.phone}</p> : null}
                    {sale.customer.email ? <p>{sale.customer.email}</p> : null}
                  </div>
                </>
              ) : (
                <p className="text-[14px] text-fg-tertiary">Consumidor final</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Información administrativa" />
            <CardBody className="space-y-3 text-[13px]">
              <div>
                <p className="text-fg-secondary">Vendedor</p>
                <p className="text-[14px] text-fg">{sale.sellerName}</p>
              </div>
              <div>
                <p className="text-fg-secondary">Fecha de la venta</p>
                <p className="text-[14px] text-fg">{formatDate(sale.saleDate)}</p>
              </div>
              <div>
                <p className="text-fg-secondary">Registrada en el sistema</p>
                <p className="text-[14px] text-fg">{formatDateTime(sale.createdAt)}</p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
