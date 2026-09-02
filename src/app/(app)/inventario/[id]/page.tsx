import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getDeviceDetail } from "@/lib/services/devices";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, BatteryIndicator } from "@/components/ui/badge";
import { ConditionBadge, InventoryStatusBadge } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AUDIT_ACTION_LABELS,
  SALE_STATUS_LABELS,
  STOCK_MOVEMENT_LABELS,
  formatStorage,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { ChangeList } from "@/components/change-list";

export const metadata = { title: "Detalle del equipo" };

export default async function DetalleEquipoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let device;
  try {
    device = await getDeviceDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NO_ENCONTRADO") notFound();
    throw error;
  }

  const user = await getCurrentUser();
  const canEdit = can(user?.role, "inventario.editar");
  const canSeeAudit = can(user?.role, "auditoria.ver");

  const activeSale = device.sales.find((sale) => sale.saleStatus === "COMPLETADA");

  return (
    <>
      <Link
        href="/inventario"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver al inventario
      </Link>

      <PageHeader
        title={`${device.brandName} ${device.modelName}`}
        description={`${device.color} · ${formatStorage(device.storageGb)}`}
        action={
          canEdit ? (
            <Link href={`/inventario/${device.id}/editar`}>
              <Button variant="secondary">
                <Pencil className="size-4" aria-hidden />
                Editar
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <InventoryStatusBadge status={device.inventoryStatus} />
        <ConditionBadge condition={device.condition} />
        {activeSale ? (
          <Badge tone="accent">Vendido en {activeSale.saleNumber}</Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Identificación" />
            <CardBody className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <DataRow label="IMEI" value={device.imei ?? "—"} mono />
              <DataRow label="Número de serie" value={device.serialNumber ?? "—"} mono />
              <div>
                <p className="text-[13px] text-fg-secondary">Batería</p>
                <div className="mt-1">
                  <BatteryIndicator percent={device.batteryPercent} />
                </div>
              </div>
              <DataRow label="Capacidad" value={formatStorage(device.storageGb)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Información económica" />
            <CardBody className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {device.canSeePurchasePrice ? (
                <DataRow
                  label="Precio de compra"
                  value={
                    device.purchasePrice === null
                      ? "No registrado"
                      : formatCurrency(device.purchasePrice, true)
                  }
                />
              ) : null}
              <DataRow
                label="Precio de venta"
                value={formatCurrency(device.salePrice, true)}
                emphasis
              />
              {device.canSeePurchasePrice && device.purchasePrice !== null ? (
                <DataRow
                  label="Margen estimado"
                  value={formatCurrency(device.salePrice - device.purchasePrice, true)}
                />
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Historial de movimientos"
              description="Los movimientos de stock no se eliminan."
            />
            {device.movements.length === 0 ? (
              <EmptyState title="Sin movimientos registrados" />
            ) : (
              <ul className="divide-y divide-line-subtle">
                {device.movements.map((movement) => (
                  <li key={movement.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-fg">
                          {STOCK_MOVEMENT_LABELS[movement.type]}
                        </p>
                        <p className="text-[13px] text-fg-secondary">{movement.reason}</p>
                        {movement.saleNumber ? (
                          <Link
                            href={`/ventas/${movement.saleId}`}
                            className="text-[13px] text-accent hover:underline"
                          >
                            {movement.saleNumber}
                          </Link>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] text-fg-secondary">{movement.userName}</p>
                        <p className="text-[12px] text-fg-tertiary">
                          {formatDateTime(movement.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {device.auditEntries.length > 0 ? (
            <Card>
              <CardHeader
                title="Historial de modificaciones"
                description="Quién cambió qué, y con qué valores."
                action={
                  canSeeAudit ? (
                    <Link
                      href={`/auditoria?entity=Device&entityId=${device.id}`}
                      className="text-[13px] font-medium text-accent hover:underline"
                    >
                      Ver en auditoría
                    </Link>
                  ) : undefined
                }
              />
              <ul className="divide-y divide-line-subtle">
                {device.auditEntries.map((entry) => (
                  <li key={entry.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-[14px] font-medium text-fg">
                        {AUDIT_ACTION_LABELS[entry.action]}
                      </p>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] text-fg-secondary">{entry.userName}</p>
                        <p className="text-[12px] text-fg-tertiary">
                          {formatDateTime(entry.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2">
                      <ChangeList changes={entry.changes} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Información administrativa" />
            <CardBody className="space-y-4">
              <DataRow label="Fecha de ingreso" value={formatDate(device.entryDate)} />
              <DataRow label="Registrado por" value={device.createdByName} />
              <DataRow label="Alta en el sistema" value={formatDateTime(device.createdAt)} />
              <DataRow
                label="Última modificación"
                value={
                  device.updatedByName
                    ? `${device.updatedByName} · ${formatDateTime(device.updatedAt)}`
                    : "Sin modificaciones"
                }
              />
              {device.notes ? <DataRow label="Observaciones" value={device.notes} /> : null}
            </CardBody>
          </Card>

          {device.sales.length > 0 ? (
            <Card>
              <CardHeader title="Ventas asociadas" />
              <ul className="divide-y divide-line-subtle">
                {device.sales.map((sale) => (
                  <li key={sale.saleItemId} className="px-5 py-3.5">
                    <Link href={`/ventas/${sale.saleId}`} className="group block">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[14px] font-medium text-fg group-hover:text-accent">
                          {sale.saleNumber}
                        </span>
                        <Badge tone={sale.saleStatus === "ANULADA" ? "danger" : "success"}>
                          {SALE_STATUS_LABELS[sale.saleStatus]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-[13px] text-fg-secondary">
                        {formatCurrency(sale.lineTotal)} · {formatDate(sale.saleDate)}
                      </p>
                      <p className="text-[12px] text-fg-tertiary">
                        {sale.customerName ?? "Consumidor final"} · {sale.sellerName}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function DataRow({
  label,
  value,
  mono,
  emphasis,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div>
      <p className="text-[13px] text-fg-secondary">{label}</p>
      <p
        className={[
          "mt-0.5 text-[14px] text-fg",
          mono ? "tabular" : "",
          emphasis ? "text-[17px] font-semibold" : "",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

