import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, Search } from "lucide-react";
import { listStoreAccessories } from "@/lib/services/storefront";
import {
  parseStoreParams,
  storeAccessoryFiltersSchema,
} from "@/lib/validations/storefront";
import { ACCESSORY_CATEGORY_LABELS } from "@/lib/constants";
import { storeConfig, whatsappLink } from "@/lib/store-config";
import { cn, formatCurrency } from "@/lib/utils";
import { StorePagination } from "@/components/store/store-pagination";
import { Container, ProductGrid } from "@/components/store/store-ui";

export const metadata: Metadata = {
  title: "Accesorios",
  description: "Fundas, vidrios templados, cargadores, cables y más accesorios para tu equipo.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AccesoriosPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseStoreParams(storeAccessoryFiltersSchema, await searchParams);
  const result = await listStoreAccessories(filters);

  function hrefFor(category?: string): string {
    const query = new URLSearchParams();
    if (category) query.set("category", category);
    if (filters.search) query.set("search", filters.search);
    const string = query.toString();
    return string ? `/tienda/accesorios?${string}` : "/tienda/accesorios";
  }

  const totalInStock = result.categories.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <Container className="py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-[40px] font-semibold leading-tight tracking-[-0.035em] text-fg sm:text-[56px]">
          Accesorios.
        </h1>
        <p className="mt-2 text-[19px] text-fg-secondary">
          Para cuidar y aprovechar tu equipo.
        </p>
      </header>

      <div className="space-y-4">
        <div
          role="group"
          aria-label="Rubro"
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0"
        >
          <CategoryChip href={hrefFor()} active={!filters.category}>
            Todos <span className="ml-1 text-[12px] opacity-60">{totalInStock}</span>
          </CategoryChip>
          {result.categories.map(({ category, count }) => (
            <CategoryChip key={category} href={hrefFor(category)} active={filters.category === category}>
              {ACCESSORY_CATEGORY_LABELS[category]}
              <span className="ml-1 text-[12px] opacity-60">{count}</span>
            </CategoryChip>
          ))}
        </div>

        {/* Formulario GET: funciona sin JavaScript. */}
        <form action="/tienda/accesorios" method="get" role="search" className="relative max-w-xl">
          {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary"
            aria-hidden
          />
          <input
            type="search"
            name="search"
            defaultValue={filters.search ?? ""}
            maxLength={80}
            placeholder="Buscar accesorio"
            aria-label="Buscar accesorio"
            className="h-11 w-full rounded-[12px] border border-line bg-surface-raised pl-10 pr-4 text-[14px] text-fg placeholder:text-fg-tertiary"
          />
        </form>

        <p className="text-[14px] text-fg-secondary" aria-live="polite">
          <span className="font-semibold text-fg">{result.total}</span>{" "}
          {result.total === 1 ? "producto" : "productos"}
        </p>
      </div>

      <div className="mt-8">
        {result.items.length === 0 ? (
          <div className="flex flex-col items-center rounded-[28px] bg-surface-raised px-6 py-20 text-center">
            <span className="mb-4 grid size-14 place-items-center rounded-full bg-surface-subtle">
              <PackageSearch className="size-6 text-fg-tertiary" aria-hidden />
            </span>
            <h2 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">
              No hay accesorios que coincidan
            </h2>
            <p className="mt-2 max-w-md text-[17px] text-fg-secondary">
              Probá con otra búsqueda o mirá todos los rubros.
            </p>
            <Link
              href="/tienda/accesorios"
              className="mt-6 inline-flex h-11 items-center rounded-full bg-accent px-6 text-[15px] text-white hover:bg-accent-hover"
            >
              Ver todos los accesorios
            </Link>
          </div>
        ) : (
          <ProductGrid>
            {result.items.map((accessory) => {
              const whatsapp = whatsappLink(
                `Hola ${storeConfig.name}, me interesa: ${accessory.name} (${formatCurrency(
                  accessory.salePrice,
                )}). ¿Tienen disponible?`,
              );

              return (
                <article
                  key={accessory.id}
                  className="flex flex-col rounded-[28px] bg-surface-raised p-6"
                >
                  <p className="text-[12px] font-semibold text-fg-secondary">
                    {ACCESSORY_CATEGORY_LABELS[accessory.category]}
                  </p>
                  <h2 className="mt-1 text-[19px] font-semibold leading-snug tracking-[-0.02em] text-fg">
                    {accessory.name}
                  </h2>
                  {accessory.brand ? (
                    <p className="mt-0.5 text-[14px] text-fg-secondary">{accessory.brand}</p>
                  ) : null}

                  <div className="mt-auto pt-6">
                    <p className="tabular text-[22px] font-semibold tracking-[-0.025em] text-fg">
                      {formatCurrency(accessory.salePrice)}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-[13px]",
                        accessory.lowStock ? "text-warning" : "text-fg-tertiary",
                      )}
                    >
                      {accessory.lowStock ? "Últimas unidades" : "Disponible"}
                    </p>
                    {whatsapp ? (
                      <a
                        href={whatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-flex h-10 items-center rounded-full border border-accent px-5 text-[14px] text-accent transition-colors hover:bg-accent-soft"
                      >
                        Consultar
                        <span className="sr-only"> por {accessory.name}</span>
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </ProductGrid>
        )}

        <StorePagination
          basePath="/tienda/accesorios"
          params={{ search: filters.search, category: filters.category }}
          page={result.page}
          pageCount={result.pageCount}
        />
      </div>
    </Container>
  );
}

function CategoryChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-[14px] font-medium transition-colors",
        active
          ? "bg-fg text-surface"
          : "bg-surface-raised text-fg-secondary hover:bg-black/5 hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}
