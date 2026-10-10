import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { DeviceCondition } from "@prisma/client";
import { cn, formatCurrency } from "@/lib/utils";
import { DEVICE_CONDITION_LABELS, formatStorage } from "@/lib/constants";
import { colorToHex } from "@/lib/colors";
import { quoteFinancing } from "@/lib/domain/financing";
import type { StoreDevice, StorePlan } from "@/lib/services/storefront";
import { DeviceArt } from "./device-art";

/// Color del estado del equipo, como el "Nuevo" naranja de apple.com.
export const CONDITION_TEXT: Record<DeviceCondition, string> = {
  NUEVO_SELLADO: "text-[#bf4800]",
  NUEVO_SIN_SELLAR: "text-success",
  USADO: "text-fg-secondary",
};

export function deviceTitle(device: Pick<StoreDevice, "brandName" | "modelName">): string {
  return `${device.brandName} ${device.modelName}`;
}

export function deviceHref(id: string): string {
  return `/tienda/equipo/${id}`;
}

/// Cuota mensual más baja entre los planes, para el "desde $X por mes".
export function lowestMonthly(
  price: number,
  plans: StorePlan[],
): { amount: number; installments: number } | null {
  let best: { amount: number; installments: number } | null = null;

  for (const plan of plans) {
    const quote = quoteFinancing(price, plan.surchargePercent, plan.installments);
    if (!best || quote.installmentAmount < best.amount) {
      best = { amount: quote.installmentAmount, installments: plan.installments };
    }
  }

  return best;
}

/// Muestra de color redonda, como las de la ficha de producto de Apple.
export function ColorSwatch({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-3.5 rounded-full ring-1 ring-black/15", className)}
      style={{ backgroundColor: colorToHex(color) }}
    />
  );
}

/// Enlace azul con flecha, el estilo "Más información >" de apple.com.
export function ArrowLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-0.5 text-[17px] text-accent hover:underline underline-offset-4",
        className,
      )}
    >
      {children}
      <ChevronRight
        className="size-4 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

export function ProductCard({
  device,
  plans = [],
}: {
  device: StoreDevice;
  plans?: StorePlan[];
}) {
  const monthly = lowestMonthly(device.salePrice, plans);
  const title = deviceTitle(device);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[28px] bg-surface-raised transition-shadow duration-300 hover:shadow-[0_8px_32px_rgb(0_0_0/0.10)]">
      <div className="grid h-[260px] place-items-center bg-surface-muted px-6 pt-8 pb-4">
        {device.imageUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen de nuestra propia API
          <img
            src={device.imageUrls[0]}
            alt=""
            loading="lazy"
            className="max-h-full max-w-full object-contain transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <DeviceArt
            type={device.type}
            color={device.color}
            className="h-full transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col px-6 pb-6 pt-5">
        <p className={cn("text-[12px] font-semibold", CONDITION_TEXT[device.condition])}>
          {DEVICE_CONDITION_LABELS[device.condition]}
        </p>

        <h3 className="mt-1 text-[21px] font-semibold leading-tight tracking-[-0.02em] text-fg">
          {/* El enlace cubre toda la tarjeta, pero el nombre sigue siendo el texto accesible. */}
          <Link
            href={deviceHref(device.id)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:outline-accent"
          >
            {title}
          </Link>
        </h3>

        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-fg-secondary">
          {device.storageGb ? <span>{formatStorage(device.storageGb)}</span> : null}
          {device.storageGb ? <span aria-hidden>·</span> : null}
          <span className="inline-flex items-center gap-1.5">
            <ColorSwatch color={device.color} />
            {device.color}
          </span>
          {device.batteryPercent !== null ? (
            <>
              <span aria-hidden>·</span>
              <span>Batería {device.batteryPercent}%</span>
            </>
          ) : null}
        </p>

        <div className="mt-auto pt-5">
          <p className="tabular text-[24px] font-semibold tracking-[-0.025em] text-fg">
            {formatCurrency(device.salePrice)}
          </p>
          {monthly ? (
            <p className="tabular mt-0.5 text-[13px] text-fg-secondary">
              o {monthly.installments} cuotas de {formatCurrency(monthly.amount)}
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] text-fg-tertiary">&nbsp;</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

/// Contenedor de ancho máximo con el gutter responsive de la tienda.
export function Container({
  children,
  className,
  narrow = false,
}: {
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div
      className={cn("mx-auto w-full px-5 sm:px-8", narrow ? "max-w-[980px]" : "max-w-[1280px]", className)}
    >
      {children}
    </div>
  );
}
