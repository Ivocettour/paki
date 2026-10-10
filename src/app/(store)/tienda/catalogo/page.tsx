import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import {
  getStoreFacets,
  listStoreDevices,
  listStorePlans,
} from "@/lib/services/storefront";
import { parseStoreParams, storeDeviceFiltersSchema } from "@/lib/validations/storefront";
import { CatalogFilters } from "@/components/store/catalog-filters";
import { StorePagination } from "@/components/store/store-pagination";
import { Container, ProductCard, ProductGrid } from "@/components/store/store-ui";

const TYPE_HEADINGS = {
  CELULAR: "Celulares",
  TABLET: "Tablets",
  RELOJ: "Relojes",
  PARLANTE: "Parlantes",
  CAMARA: "Cámaras",
  OTRO: "Otros productos",
} as const;

/// Para titular la página: "Celulares nuevos sin sellar".
const CONDITION_PLURAL = {
  NUEVO_SELLADO: "nuevos sellados",
  NUEVO_SIN_SELLAR: "nuevos sin sellar",
  USADO: "usados",
} as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const filters = parseStoreParams(storeDeviceFiltersSchema, await searchParams);
  const title = filters.type ? TYPE_HEADINGS[filters.type] : "Catálogo";

  return {
    title,
    description: `${title} disponibles hoy: nuevos sellados, nuevos sin sellar y usados con la batería informada.`,
  };
}

export default async function CatalogoPage({ searchParams }: { searchParams: SearchParams }) {
  const rawParams = await searchParams;
  const filters = parseStoreParams(storeDeviceFiltersSchema, rawParams);

  const [result, facets, plans] = await Promise.all([
    listStoreDevices(filters),
    getStoreFacets(),
    listStorePlans(),
  ]);

  const heading = filters.condition
    ? `${filters.type ? TYPE_HEADINGS[filters.type] : "Equipos"} ${CONDITION_PLURAL[filters.condition]}`
    : filters.type
      ? TYPE_HEADINGS[filters.type]
      : "Todo el catálogo";

  // Parámetros ya validados, para que la paginación no arrastre basura de la URL.
  const cleanParams = {
    search: filters.search,
    type: filters.type,
    brandId: filters.brandId,
    condition: filters.condition,
    storageGb: filters.storageGb ? String(filters.storageGb) : undefined,
    maxPrice: filters.maxPrice ? String(filters.maxPrice) : undefined,
    sort: filters.sort === "recent" ? undefined : filters.sort,
  };

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-[40px] font-semibold leading-tight tracking-[-0.035em] text-fg sm:text-[56px]">
          {heading}
        </h1>
        <p className="mt-2 text-[19px] text-fg-secondary">
          Stock real del local. Cada tarjeta es una unidad única.
        </p>
      </header>

      <CatalogFilters facets={facets} resultCount={result.total} />

      <div className="mt-8">
        {result.items.length === 0 ? (
          <div className="flex flex-col items-center rounded-[28px] bg-surface-raised px-6 py-20 text-center">
            <span className="mb-4 grid size-14 place-items-center rounded-full bg-surface-subtle">
              <SearchX className="size-6 text-fg-tertiary" aria-hidden />
            </span>
            <h2 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">
              No encontramos equipos con esos filtros
            </h2>
            <p className="mt-2 max-w-md text-[17px] text-fg-secondary">
              Probá quitando algún filtro, o escribinos y te conseguimos lo que buscás.
            </p>
            <Link
              href="/tienda/catalogo"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-accent px-6 text-[15px] text-white hover:bg-accent-hover"
            >
              Ver todo el catálogo
            </Link>
          </div>
        ) : (
          <ProductGrid>
            {result.items.map((device) => (
              <ProductCard key={device.id} device={device} plans={plans} />
            ))}
          </ProductGrid>
        )}

        <StorePagination
          basePath="/tienda/catalogo"
          params={cleanParams}
          page={result.page}
          pageCount={result.pageCount}
        />
      </div>
    </Container>
  );
}
