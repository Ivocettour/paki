import { Suspense } from "react";
import type { Metadata } from "next";
import { storeConfig } from "@/lib/store-config";
import { StoreNav, type StoreNavLink } from "@/components/store/store-nav";
import { StoreFooter } from "@/components/store/store-footer";

/// A diferencia del sistema interno, la tienda sí debe poder encontrarse.
export const metadata: Metadata = {
  title: {
    default: `${storeConfig.name} · Celulares nuevos y usados`,
    template: `%s · ${storeConfig.name}`,
  },
  description: `Celulares nuevos sellados, nuevos sin sellar y usados con la batería informada. Mirá el stock de ${storeConfig.name} y consultá por WhatsApp.`,
  robots: { index: true, follow: true },
};

const NAV_LINKS: StoreNavLink[] = [
  { href: "/tienda", label: "Inicio" },
  { href: "/tienda/catalogo?type=CELULAR", label: "Celulares" },
  { href: "/tienda/catalogo?type=TABLET", label: "Tablets" },
  { href: "/tienda/catalogo?type=RELOJ", label: "Relojes" },
  { href: "/tienda/accesorios", label: "Accesorios" },
  { href: "/tienda/catalogo", label: "Todo el catálogo" },
];

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-subtle">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      {/* `useSearchParams` en la barra exige un límite de Suspense. */}
      <Suspense fallback={<div className="h-12 bg-[#161617]" />}>
        <StoreNav storeName={storeConfig.name} links={NAV_LINKS} />
      </Suspense>
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <StoreFooter />
    </div>
  );
}
