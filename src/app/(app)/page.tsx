import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  Package,
  Receipt,
  Wallet,
} from "lucide-react";
import { getDashboardData } from "@/lib/services/dashboard";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { STOCK_MOVEMENT_LABELS } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { StockMovementType } from "@prisma/client";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          data.showsEconomicMetrics
            ? "Resumen operativo del local."
            : "Resumen de tu actividad."
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Equipos disponibles"
          value={String(data.availableDevices)}
          icon={Package}
          hint="En stock, listos para vender"
        />
        <StatCard
          label="Equipos vendidos"
          value={String(data.soldDevices)}
          icon={Receipt}
          hint="Histórico total"
        />
        <StatCard
          label={data.showsEconomicMetrics ? "Ventas de hoy" : "Tus ventas de hoy"}
          value={String(data.salesToday.count)}
          hint={
            data.showsEconomicMetrics
              ? formatCurrency(data.salesToday.total)
              : `${data.salesToday.count === 1 ? "operación" : "operaciones"}`
          }
        />
        <StatCard
          label={data.showsEconomicMetrics ? "Ventas del mes" : "Tus ventas del mes"}
          value={String(data.salesThisMonth.count)}
          hint={
            data.showsEconomicMetrics
              ? formatCurrency(data.salesThisMonth.total)
              : `${data.salesThisMonth.count === 1 ? "operación" : "operaciones"}`
          }
        />
      </div>

      {data.showsEconomicMetrics ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Valor estimado del inventario"
            value={formatCurrency(data.inventoryValue ?? 0)}
            icon={Wallet}
            hint="Suma de precios de venta de equipos disponibles"
          />
          <StatCard
            label="Productos con stock bajo"
            value={String(data.lowStock.length + data.lowStockAccessories.length)}
            icon={AlertTriangle}
            tone={
              data.lowStock.length + data.lowStockAccessories.length > 0
                ? "warning"
                : "neutral"
            }
            hint={
              data.lowStock.length + data.lowStockAccessories.length > 0
                ? `${data.lowStock.length} modelos · ${data.lowStockAccessories.length} accesorios`
                : "Todo por encima del mínimo"
            }
          />
        </div>
      ) : null}

      {data.installments &&
      (data.installments.overdueCount > 0 || data.installments.dueSoonCount > 0) ? (
        <Card className="mt-4 overflow-hidden">
          <CardHeader
            title="Cuotas a cobrar"
            description="Ventas financiadas por el local"
            action={
              <Link
                href="/cuotas"
                className="text-[13px] font-medium text-accent hover:underline"
              >
                Ver cuotas
              </Link>
            }
          />
          <div className="grid grid-cols-1 divide-y divide-line-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            <Link
              href="/cuotas?estado=vencidas"
              className="group px-5 py-4 transition-colors hover:bg-surface-subtle/60"
            >
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-fg-secondary">
                <AlertTriangle className="size-3.5 text-danger" aria-hidden />
                Vencidas
              </p>
              <p className="tabular mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] text-danger">
                {formatCurrency(data.installments.overdueAmount)}
              </p>
              <p className="mt-1.5 text-[12px] text-fg-tertiary">
                {data.installments.overdueCount}{" "}
                {data.installments.overdueCount === 1 ? "cuota" : "cuotas"} sin cobrar
              </p>
            </Link>

            <Link
              href="/cuotas?estado=proximas"
              className="group px-5 py-4 transition-colors hover:bg-surface-subtle/60"
            >
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-fg-secondary">
                <CalendarClock className="size-3.5 text-warning" aria-hidden />
                Vencen en 7 días
              </p>
              <p className="tabular mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] text-fg">
                {formatCurrency(data.installments.dueSoonAmount)}
              </p>
              <p className="mt-1.5 text-[12px] text-fg-tertiary">
                {data.installments.dueSoonCount}{" "}
                {data.installments.dueSoonCount === 1 ? "cuota próxima" : "cuotas próximas"}
              </p>
            </Link>
          </div>
        </Card>
      ) : null}

      {data.showsEconomicMetrics &&
      (data.lowStock.length > 0 || data.lowStockAccessories.length > 0) ? (
        <Card className="mt-4">
          <CardHeader
            title="Stock bajo"
            description="Productos por debajo del mínimo configurado."
          />
          <ul className="divide-y divide-line-subtle">
            {data.lowStock.slice(0, 5).map((model) => (
              <li
                key={model.modelId}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <Link
                  href={`/inventario?modelId=${model.modelId}`}
                  className="text-[14px] text-fg hover:text-accent"
                >
                  {model.brandName} {model.modelName}
                </Link>
                <span className="tabular text-[13px] text-fg-secondary">
                  <span className="font-medium text-warning">{model.available}</span> /{" "}
                  {model.minStock} mín.
                </span>
              </li>
            ))}

            {data.lowStockAccessories.slice(0, 5).map((accessory) => (
              <li
                key={accessory.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <Link
                  href="/accesorios"
                  className="text-[14px] text-fg hover:text-accent"
                >
                  {accessory.name}
                  <span className="ml-2 text-[12px] text-fg-tertiary">accesorio</span>
                </Link>
                <span className="tabular text-[13px] text-fg-secondary">
                  <span
                    className={
                      accessory.available === 0
                        ? "font-medium text-danger"
                        : "font-medium text-warning"
                    }
                  >
                    {accessory.available}
                  </span>{" "}
                  / {accessory.minStock} mín.
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div
        className={
          data.showsMovements
            ? "mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2"
            : "mt-4 grid grid-cols-1 gap-4"
        }
      >
        <Card>
          <CardHeader
            title={data.showsEconomicMetrics ? "Últimas ventas" : "Tus últimas ventas"}
            action={
              <Link
                href="/ventas"
                className="text-[13px] font-medium text-accent hover:underline"
              >
                Ver todas
              </Link>
            }
          />
          {data.recentSales.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Todavía no hay ventas"
              description="Las ventas registradas van a aparecer acá."
            />
          ) : (
            <ul className="divide-y divide-line-subtle">
              {data.recentSales.map((sale) => (
                <li key={sale.id} className="px-5 py-3.5">
                  <Link href={`/ventas/${sale.id}`} className="group flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-fg group-hover:text-accent">
                        {sale.saleNumber}
                      </p>
                      <p className="truncate text-[12px] text-fg-tertiary">
                        {sale.customerName ?? "Consumidor final"} · {sale.sellerName}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tabular text-[14px] font-medium text-fg">
                        {formatCurrency(sale.total)}
                      </p>
                      <p className="text-[12px] text-fg-tertiary">
                        {formatDateTime(sale.saleDate)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {data.showsMovements ? (
        <Card>
          <CardHeader
            title="Últimos movimientos"
            action={
              <Link
                href="/movimientos"
                className="text-[13px] font-medium text-accent hover:underline"
              >
                Ver todos
              </Link>
            }
          />
          {data.recentMovements.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="Sin movimientos registrados"
              description="Los ingresos, ventas y ajustes de stock quedan registrados acá."
            />
          ) : (
            <ul className="divide-y divide-line-subtle">
              {data.recentMovements.map((movement) => (
                <li key={movement.id} className="flex items-start gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-fg">
                      {STOCK_MOVEMENT_LABELS[movement.type as StockMovementType]}
                    </p>
                    <p className="truncate text-[12px] text-fg-tertiary">
                      {movement.deviceLabel}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] text-fg-secondary">{movement.userName}</p>
                    <p className="text-[12px] text-fg-tertiary">
                      {formatDateTime(movement.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        ) : null}
      </div>
    </>
  );
}
