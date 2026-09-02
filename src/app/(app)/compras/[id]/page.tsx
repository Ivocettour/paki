import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { getPurchaseDetail } from "@/lib/services/purchases";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import {
  ACCESSORY_CATEGORY_LABELS,
  DEVICE_CONDITION_LABELS,
  DEVICE_TYPE_LABELS,
  PURCHASE_STATUS_LABELS,
  formatStorage,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { PurchaseActions } from "./purchase-actions";

export const metadata = { title: "Detalle de la compra" };

export default async function DetalleCompraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!can(user?.role, "compras.ver")) redirect("/");

  const { id } = await params;

  let purchase;
  try {
    purchase = await getPurchaseDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NO_ENCONTRADO") notFound();
    throw error;
  }

  const canManage = can(user?.role, "compras.gestionar");
  const isDraft = purchase.status === "BORRADOR";

  const deviceCount = purchase.items.filter((item) => item.isDevice).length;
  const accessoryUnits = purchase.items
    .filter((item) => !item.isDevice)
    .reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <Link
        href="/compras"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a compras
      </Link>

      <PageHeader
        title={purchase.purchaseNumber}
        description={`${purchase.supplier.name} · ${formatDate(purchase.purchaseDate)}`}
        action={
          canManage && isDraft ? (
            <PurchaseActions
              purchaseId={purchase.id}
              purchaseNumber={purchase.purchaseNumber}
              deviceCount={deviceCount}
              accessoryUnits={accessoryUnits}
            />
          ) : null
        }
      />

      <div className="mb-4">
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
      </div>

      {isDraft ? (
        <Card className="mb-4 border-warning/30 bg-warning-soft">
          <CardBody>
            <p className="text-[14px] font-medium text-warning">
              La mercadería todavía no ingresó
            </p>
            <p className="mt-1 text-[13px] text-fg-secondary">
              Esta compra está en borrador. El inventario se actualiza recién al
              confirmarla.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {purchase.status === "CONFIRMADA" ? (
        <Card className="mb-4 border-success/30 bg-success-soft">
          <CardBody className="flex items-start gap-2.5">
            <PackageCheck className="size-4 shrink-0 mt-0.5 text-success" aria-hidden />
            <div>
              <p className="text-[14px] font-medium text-success">
                Mercadería ingresada al inventario
              </p>
              <p className="mt-1 text-[13px] text-fg-secondary">
                {purchase.confirmedAt ? formatDateTime(purchase.confirmedAt) : ""}
                {deviceCount > 0
                  ? ` · ${deviceCount} ${deviceCount === 1 ? "equipo creado" : "equipos creados"}`
                  : ""}
                {accessoryUnits > 0
                  ? ` · ${accessoryUnits} ${
                      accessoryUnits === 1 ? "unidad sumada" : "unidades sumadas"
                    } al stock`
                  : ""}
              </p>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader
            title="Mercadería"
            description={`${purchase.items.length} ${
              purchase.items.length === 1 ? "ítem" : "ítems"
            }`}
          />
          <TableWrapper>
            <Table className="min-w-[700px]">
              <thead>
                <tr>
                  <Th>Producto</Th>
                  <Th align="center">Cant.</Th>
                  <Th align="right">Costo unit.</Th>
                  <Th align="right">Subtotal</Th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item) => (
                  <Tr key={item.id}>
                    <Td>
                      {item.isDevice ? (
                        <>
                          {item.deviceId ? (
                            <Link
                              href={`/inventario/${item.deviceId}`}
                              className="font-medium hover:text-accent"
                            >
                              {item.brandName} {item.modelName}
                            </Link>
                          ) : (
                            <span className="font-medium">
                              {item.brandName} {item.modelName}
                            </span>
                          )}
                          <span className="block text-[12px] text-fg-tertiary">
                            {[
                              item.deviceType
                                ? DEVICE_TYPE_LABELS[item.deviceType]
                                : null,
                              item.color,
                              item.storageGb ? formatStorage(item.storageGb) : null,
                              item.condition
                                ? DEVICE_CONDITION_LABELS[item.condition]
                                : null,
                              item.batteryPercent !== null
                                ? `batería ${item.batteryPercent}%`
                                : null,
                              item.imei ? `IMEI ${item.imei}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          {item.salePrice !== null ? (
                            <span className="block text-[12px] text-fg-tertiary">
                              Entra a la venta en {formatCurrency(item.salePrice)}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <Link
                            href="/accesorios"
                            className="font-medium hover:text-accent"
                          >
                            {item.accessoryName}
                          </Link>
                          <span className="block text-[12px] text-fg-tertiary">
                            {item.accessoryCategory
                              ? ACCESSORY_CATEGORY_LABELS[item.accessoryCategory]
                              : "Accesorio"}
                          </span>
                        </>
                      )}
                    </Td>
                    <Td align="center">
                      <span className="tabular">{item.quantity}</span>
                    </Td>
                    <Td align="right">
                      <span className="tabular text-[13px]">
                        {formatCurrency(item.unitCost)}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="tabular font-medium">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrapper>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Total" />
            <CardBody>
              <p className="tabular text-[26px] font-semibold tracking-[-0.03em] text-fg">
                {formatCurrency(purchase.total)}
              </p>
              <p className="mt-1 text-[13px] text-fg-tertiary">
                Costo de la mercadería comprada
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Proveedor" />
            <CardBody className="space-y-2 text-[13px]">
              <p className="text-[15px] font-medium text-fg">{purchase.supplier.name}</p>
              {purchase.supplier.cuit ? (
                <p className="text-fg-secondary">CUIT {purchase.supplier.cuit}</p>
              ) : null}
              {purchase.supplier.phone ? (
                <p className="text-fg-secondary">{purchase.supplier.phone}</p>
              ) : null}
              {purchase.supplier.email ? (
                <p className="text-fg-secondary">{purchase.supplier.email}</p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Información administrativa" />
            <CardBody className="space-y-3 text-[13px]">
              <div>
                <p className="text-fg-secondary">Registró</p>
                <p className="text-[14px] text-fg">{purchase.userName}</p>
              </div>
              <div>
                <p className="text-fg-secondary">Fecha de la compra</p>
                <p className="text-[14px] text-fg">{formatDate(purchase.purchaseDate)}</p>
              </div>
              <div>
                <p className="text-fg-secondary">Cargada en el sistema</p>
                <p className="text-[14px] text-fg">{formatDateTime(purchase.createdAt)}</p>
              </div>
              {purchase.notes ? (
                <div>
                  <p className="text-fg-secondary">Observaciones</p>
                  <p className="text-[14px] text-fg">{purchase.notes}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
