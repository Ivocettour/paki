import Link from "next/link";
import { ArrowRight, MapPin, MessageCircle } from "lucide-react";
import type { DeviceCondition } from "@prisma/client";
import {
  getStoreFacets,
  listFeaturedDevices,
  listStorePlans,
} from "@/lib/services/storefront";
import { DEVICE_CONDITION_DESCRIPTIONS, DEVICE_CONDITION_LABELS } from "@/lib/constants";
import { quoteFinancing } from "@/lib/domain/financing";
import { storeConfig, whatsappLink } from "@/lib/store-config";
import { cn, formatCurrency } from "@/lib/utils";
import { DeviceArt } from "@/components/store/device-art";
import {
  ArrowLink,
  CONDITION_TEXT,
  Container,
  ProductCard,
  ProductGrid,
} from "@/components/store/store-ui";

/// El stock cambia con cada venta: la portada nunca se fija en el build.
export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: `${storeConfig.name} · Celulares nuevos y usados` },
};

const CONDITION_ORDER: DeviceCondition[] = ["NUEVO_SELLADO", "NUEVO_SIN_SELLAR", "USADO"];

export default async function TiendaHomePage() {
  const [facets, featured, plans] = await Promise.all([
    getStoreFacets(),
    listFeaturedDevices(8),
    listStorePlans(),
  ]);

  const whatsapp = whatsappLink(`Hola ${storeConfig.name}, quiero consultar por un equipo.`);

  // Los tres equipos que se dibujan en el hero salen del stock real.
  const heroDevices = featured.slice(0, 3);
  const centerIndex = Math.min(1, heroDevices.length - 1);
  const conditionTiles = CONDITION_ORDER.map((condition) =>
    facets.conditions.find((entry) => entry.condition === condition),
  ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  // La mejor oferta de cuotas, para la banda de financiación.
  const sampleDevice = featured[0];
  const maxInstallments = plans.reduce((max, plan) => Math.max(max, plan.installments), 0);
  const interestFree = plans
    .filter((plan) => plan.surchargePercent === 0)
    .reduce((max, plan) => Math.max(max, plan.installments), 0);

  return (
    <>
      {/* Hero */}
      <section className="overflow-hidden bg-black text-[#f5f5f7]">
        <Container className="flex flex-col items-center pt-16 text-center sm:pt-24">
          <p className="text-[17px] font-semibold text-[#f5a46a] sm:text-[21px]">
            Nuevos, sin sellar y usados
          </p>
          <h1 className="mt-2 max-w-[820px] text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[64px]">
            El celular que querés, al precio justo.
          </h1>
          <p className="mt-4 max-w-[560px] text-[19px] leading-snug text-[#a1a1a6] sm:text-[21px]">
            Cada equipo es una unidad real, con su estado y su batería a la vista. Sin sorpresas.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/tienda/catalogo?type=CELULAR"
              className="inline-flex h-12 items-center rounded-full bg-[#0071e3] px-7 text-[17px] text-white transition-colors hover:bg-[#0077ed]"
            >
              Ver celulares
            </Link>
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[17px] text-[#2997ff] hover:underline"
              >
                <MessageCircle className="size-5" aria-hidden />
                Consultar por WhatsApp
              </a>
            ) : null}
          </div>

          <div className="mt-14 flex h-[260px] items-end justify-center gap-4 sm:h-[360px] sm:gap-10" aria-hidden>
            {heroDevices.length > 0 ? (
              heroDevices.map((device, index) => (
                <DeviceArt
                  key={device.id}
                  type={device.type}
                  color={device.color}
                  className={cn(
                    "w-auto drop-shadow-none",
                    // En pantallas chicas solo se dibuja el equipo central.
                    index === centerIndex ? "h-full" : "hidden h-[82%] opacity-95 sm:block",
                  )}
                />
              ))
            ) : (
              <DeviceArt type="CELULAR" color="Titanio natural" className="h-full drop-shadow-none" />
            )}
          </div>
        </Container>
      </section>

      {/* Estado del equipo */}
      {conditionTiles.length > 0 ? (
        <section aria-labelledby="estados" className="py-16 sm:py-24">
          <Container>
            <h2
              id="estados"
              className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[48px]"
            >
              Elegí cómo lo querés.
            </h2>
            <p className="mt-2 max-w-[640px] text-[19px] text-fg-secondary">
              Todos los equipos se revisan y se informan tal cual están.
            </p>

            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {conditionTiles.map((tile) => (
                <li key={tile.condition}>
                  <Link
                    href={`/tienda/catalogo?condition=${tile.condition}`}
                    className="group flex h-full flex-col rounded-[28px] bg-surface-raised p-8 transition-shadow hover:shadow-[0_8px_32px_rgb(0_0_0/0.10)]"
                  >
                    <span className={cn("text-[14px] font-semibold", CONDITION_TEXT[tile.condition])}>
                      {tile.count} {tile.count === 1 ? "disponible" : "disponibles"}
                    </span>
                    <span className="mt-1 text-[28px] font-semibold tracking-[-0.025em] text-fg">
                      {DEVICE_CONDITION_LABELS[tile.condition]}
                    </span>
                    <span className="mt-2 text-[17px] text-fg-secondary">
                      {DEVICE_CONDITION_DESCRIPTIONS[tile.condition]}
                    </span>
                    <span className="mt-auto flex items-end justify-between pt-8">
                      <span className="tabular text-[17px] text-fg">
                        Desde{" "}
                        <span className="font-semibold">{formatCurrency(tile.minPrice)}</span>
                      </span>
                      <ArrowRight
                        className="size-5 text-accent transition-transform group-hover:translate-x-1"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ) : null}

      {/* Recién llegados */}
      {featured.length > 0 ? (
        <section aria-labelledby="novedades" className="bg-surface-raised py-16 sm:py-24">
          <Container>
            <div className="mb-10 flex items-end justify-between gap-4">
              <h2
                id="novedades"
                className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[48px]"
              >
                Recién llegados.
              </h2>
              <ArrowLink href="/tienda/catalogo?type=CELULAR" className="shrink-0">
                Ver todos
              </ArrowLink>
            </div>

            <div className="[&_article]:bg-surface-subtle [&_article>div:first-child]:bg-surface-subtle">
              <ProductGrid>
                {featured.map((device) => (
                  <ProductCard key={device.id} device={device} plans={plans} />
                ))}
              </ProductGrid>
            </div>
          </Container>
        </section>
      ) : (
        <section className="py-24">
          <Container className="text-center">
            <h2 className="text-[32px] font-semibold tracking-[-0.03em] text-fg">
              Estamos cargando el stock.
            </h2>
            <p className="mt-2 text-[19px] text-fg-secondary">
              Volvé en un rato o escribinos para consultar lo que buscás.
            </p>
          </Container>
        </section>
      )}

      {/* Categorías */}
      {facets.types.length > 1 || facets.total > 0 ? (
        <section aria-labelledby="categorias" className="py-16 sm:py-24">
          <Container>
            <h2
              id="categorias"
              className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[48px]"
            >
              Y mucho más.
            </h2>
            <ul className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
              {facets.types.map(({ type, count }) => (
                <li key={type}>
                  <Link
                    href={`/tienda/catalogo?type=${type}`}
                    className="flex h-full flex-col items-center rounded-[28px] bg-surface-raised px-4 py-8 text-center transition-shadow hover:shadow-[0_8px_32px_rgb(0_0_0/0.10)]"
                  >
                    <span className="h-24">
                      <DeviceArt type={type} color="Plata" className="h-full drop-shadow-none" />
                    </span>
                    <span className="mt-4 text-[19px] font-semibold tracking-[-0.02em] text-fg">
                      {TYPE_PLURAL[type]}
                    </span>
                    <span className="text-[14px] text-fg-secondary">{count} disponibles</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/tienda/accesorios"
                  className="flex h-full flex-col items-center justify-center rounded-[28px] bg-surface-raised px-4 py-8 text-center transition-shadow hover:shadow-[0_8px_32px_rgb(0_0_0/0.10)]"
                >
                  <span className="text-[19px] font-semibold tracking-[-0.02em] text-fg">
                    Accesorios
                  </span>
                  <span className="mt-1 text-[14px] text-fg-secondary">
                    Fundas, cargadores, templados y más
                  </span>
                </Link>
              </li>
            </ul>
          </Container>
        </section>
      ) : null}

      {/* Cuotas */}
      {plans.length > 0 && sampleDevice ? (
        <section aria-labelledby="cuotas" className="bg-black py-16 text-[#f5f5f7] sm:py-24">
          <Container narrow className="text-center">
            <h2
              id="cuotas"
              className="text-[32px] font-semibold leading-tight tracking-[-0.03em] sm:text-[48px]"
            >
              Pagalo como te quede cómodo.
            </h2>
            <p className="mx-auto mt-3 max-w-[620px] text-[19px] text-[#a1a1a6]">
              {interestFree > 0
                ? `Hasta ${interestFree} cuotas sin interés y financiación en hasta ${maxInstallments} cuotas.`
                : `Financiación en hasta ${maxInstallments} cuotas.`}{" "}
              Mirá el valor de cada cuota en la ficha de cada equipo.
            </p>
            <p className="tabular mt-6 text-[15px] text-[#a1a1a6]">
              Ejemplo: un equipo de {formatCurrency(sampleDevice.salePrice)} en{" "}
              {maxInstallments} cuotas de{" "}
              <span className="font-semibold text-white">
                {formatCurrency(
                  Math.min(
                    ...plans
                      .filter((plan) => plan.installments === maxInstallments)
                      .map(
                        (plan) =>
                          quoteFinancing(
                            sampleDevice.salePrice,
                            plan.surchargePercent,
                            plan.installments,
                          ).installmentAmount,
                      ),
                  ),
                )}
              </span>
              .
            </p>
          </Container>
        </section>
      ) : null}

      {/* Visitanos */}
      <section aria-labelledby="visitanos" className="py-16 sm:py-24">
        <Container narrow className="text-center">
          <h2
            id="visitanos"
            className="text-[32px] font-semibold leading-tight tracking-[-0.03em] text-fg sm:text-[48px]"
          >
            Venite a verlos.
          </h2>
          <p className="mx-auto mt-3 max-w-[560px] text-[19px] text-fg-secondary">
            Tocalos, probalos y llevate el tuyo en el momento.
          </p>

          <div className="mt-6 space-y-1 text-[17px] text-fg">
            {storeConfig.address ? (
              <p className="inline-flex items-center gap-2">
                <MapPin className="size-5 text-fg-tertiary" aria-hidden />
                {storeConfig.address}
              </p>
            ) : null}
            {storeConfig.hours ? <p className="text-fg-secondary">{storeConfig.hours}</p> : null}
          </div>

          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-[17px] text-white transition-colors hover:bg-accent-hover"
            >
              <MessageCircle className="size-5" aria-hidden />
              Escribinos por WhatsApp
            </a>
          ) : null}
        </Container>
      </section>
    </>
  );
}

const TYPE_PLURAL = {
  CELULAR: "Celulares",
  TABLET: "Tablets",
  RELOJ: "Relojes",
  PARLANTE: "Parlantes",
  CAMARA: "Cámaras",
  OTRO: "Otros",
} as const;
