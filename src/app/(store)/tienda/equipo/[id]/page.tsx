import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { getStoreDevice, listStorePlans } from "@/lib/services/storefront";
import {
  DEVICE_CONDITION_DESCRIPTIONS,
  DEVICE_CONDITION_LABELS,
  DEVICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  formatStorage,
} from "@/lib/constants";
import { storeConfig, whatsappLink } from "@/lib/store-config";
import { cn, formatCurrency } from "@/lib/utils";
import { DeviceArt } from "@/components/store/device-art";
import { FinancingOptions } from "@/components/store/financing-options";
import {
  CONDITION_TEXT,
  ColorSwatch,
  Container,
  ProductCard,
  ProductGrid,
  deviceTitle,
  lowestMonthly,
} from "@/components/store/store-ui";
import { BatteryIndicator } from "@/components/ui/badge";

type Params = Promise<{ id: string }>;

function describe(device: NonNullable<Awaited<ReturnType<typeof getStoreDevice>>>): string {
  return [
    deviceTitle(device),
    device.storageGb ? formatStorage(device.storageGb) : null,
    device.color,
  ]
    .filter(Boolean)
    .join(" · ");
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const device = await getStoreDevice(id);

  if (!device) return { title: "Equipo no disponible", robots: { index: false } };

  return {
    title: describe(device),
    description: `${DEVICE_CONDITION_LABELS[device.condition]}. ${formatCurrency(
      device.salePrice,
    )}. Consultá disponibilidad y financiación en ${storeConfig.name}.`,
  };
}

const SCHEMA_CONDITION = {
  NUEVO_SELLADO: "https://schema.org/NewCondition",
  NUEVO_SIN_SELLAR: "https://schema.org/NewCondition",
  USADO: "https://schema.org/UsedCondition",
} as const;

export default async function EquipoPage({ params }: { params: Params }) {
  const { id } = await params;

  const [device, plans] = await Promise.all([getStoreDevice(id), listStorePlans()]);
  if (!device) notFound();

  const title = deviceTitle(device);
  const monthly = lowestMonthly(device.salePrice, plans);

  const whatsapp = whatsappLink(
    `Hola ${storeConfig.name}, me interesa el ${describe(device)} (${DEVICE_CONDITION_LABELS[
      device.condition
    ].toLowerCase()}) a ${formatCurrency(device.salePrice)}. ¿Sigue disponible?`,
  );

  const specs: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Tipo", value: DEVICE_TYPE_LABELS[device.type] },
    {
      label: "Estado",
      value: (
        <span>
          <span className={cn("font-semibold", CONDITION_TEXT[device.condition])}>
            {DEVICE_CONDITION_LABELS[device.condition]}
          </span>
          <span className="mt-0.5 block text-[13px] font-normal text-fg-tertiary">
            {DEVICE_CONDITION_DESCRIPTIONS[device.condition]}
          </span>
        </span>
      ),
    },
    {
      label: "Color",
      value: (
        <span className="inline-flex items-center gap-2">
          <ColorSwatch color={device.color} className="size-4" />
          {device.color}
        </span>
      ),
    },
  ];

  if (device.storageGb) {
    specs.push({ label: "Almacenamiento", value: formatStorage(device.storageGb) });
  }
  if (device.batteryPercent !== null) {
    specs.push({
      label: "Batería",
      value: <BatteryIndicator percent={device.batteryPercent} />,
    });
  }

  // Datos estructurados para que los buscadores muestren precio y estado.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: describe(device),
    brand: { "@type": "Brand", name: device.brandName },
    color: device.color,
    itemCondition: SCHEMA_CONDITION[device.condition],
    offers: {
      "@type": "Offer",
      priceCurrency: "ARS",
      price: device.salePrice,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // El contenido es JSON generado por nosotros; se escapa "<" por seguridad.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <Container className="py-6 sm:py-10">
        <Link
          href="/tienda/catalogo"
          className="mb-6 inline-flex items-center gap-1 text-[14px] text-accent hover:underline"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Volver al catálogo
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <div className="lg:sticky lg:top-20 lg:self-start">
            <div className="grid h-[380px] place-items-center rounded-[28px] bg-surface-raised px-8 py-10 sm:h-[520px]">
              <DeviceArt
                type={device.type}
                color={device.color}
                label={`${title}, color ${device.color}`}
                className="h-full"
              />
            </div>
          </div>

          <div>
            <p className={cn("text-[14px] font-semibold", CONDITION_TEXT[device.condition])}>
              {DEVICE_CONDITION_LABELS[device.condition]}
            </p>
            <h1 className="mt-1 text-[36px] font-semibold leading-[1.08] tracking-[-0.035em] text-fg sm:text-[48px]">
              {title}
            </h1>
            <p className="mt-2 text-[19px] text-fg-secondary">
              {[device.storageGb ? formatStorage(device.storageGb) : null, device.color]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div className="mt-6">
              <p className="tabular text-[34px] font-semibold tracking-[-0.03em] text-fg">
                {formatCurrency(device.salePrice)}
              </p>
              {monthly ? (
                <p className="tabular mt-1 text-[15px] text-fg-secondary">
                  o {monthly.installments} cuotas de {formatCurrency(monthly.amount)}
                </p>
              ) : null}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-7 text-[17px] text-white transition-colors hover:bg-accent-hover"
                >
                  <MessageCircle className="size-5" aria-hidden />
                  Consultar por WhatsApp
                </a>
              ) : (
                <p className="flex-1 rounded-[16px] bg-surface-raised px-5 py-3.5 text-[15px] text-fg-secondary">
                  Pasá por el local para llevártelo{storeConfig.address ? `: ${storeConfig.address}` : ""}.
                </p>
              )}
            </div>

            <p className="mt-3 flex items-start gap-2 text-[13px] text-fg-tertiary">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              Es una unidad única. Si alguien se lo lleva antes, deja de aparecer en la tienda.
            </p>

            <dl className="mt-8 divide-y divide-line-subtle rounded-[20px] bg-surface-raised">
              {specs.map((spec) => (
                <div key={spec.label} className="flex items-start justify-between gap-6 px-5 py-4">
                  <dt className="text-[14px] text-fg-secondary">{spec.label}</dt>
                  <dd className="text-right text-[15px] font-medium text-fg">{spec.value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-4 text-[13px] leading-relaxed text-fg-tertiary">
              Medios de pago: {Object.values(PAYMENT_METHOD_LABELS).slice(0, 4).join(", ").toLowerCase()}
              {plans.length > 0 ? " y cuotas" : ""}.
            </p>

            {storeConfig.address ? (
              <p className="mt-3 flex items-start gap-2 text-[14px] text-fg-secondary">
                <MapPin className="mt-0.5 size-4 shrink-0 text-fg-tertiary" aria-hidden />
                <span>
                  {storeConfig.address}
                  {storeConfig.hours ? <span className="block text-fg-tertiary">{storeConfig.hours}</span> : null}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-12">
          <FinancingOptions price={device.salePrice} plans={plans} />
        </div>

        {device.related.length > 0 ? (
          <section aria-labelledby="otras-opciones" className="mt-16">
            <h2
              id="otras-opciones"
              className="mb-6 text-[28px] font-semibold tracking-[-0.03em] text-fg sm:text-[34px]"
            >
              Otras opciones de {device.brandName} {device.modelName}.
            </h2>
            <ProductGrid>
              {device.related.map((related) => (
                <ProductCard key={related.id} device={related} plans={plans} />
              ))}
            </ProductGrid>
          </section>
        ) : null}
      </Container>
    </>
  );
}
