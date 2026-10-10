"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Lock, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StoreNavLink {
  href: string;
  label: string;
}

/// Un enlace con `?type=` solo está activo si el catálogo muestra ese tipo.
function isActive(href: string, pathname: string, searchParams: URLSearchParams): boolean {
  const [path, query] = href.split("?");
  if (path === "/tienda") return pathname === "/tienda";
  if (pathname !== path) return false;

  const wantedType = new URLSearchParams(query ?? "").get("type");
  return (searchParams.get("type") ?? null) === wantedType;
}

/**
 * Barra de navegación global de la tienda, con el aspecto de apple.com:
 * 48 px, translúcida, texto chico y claro sobre fondo oscuro.
 *
 * En pantallas chicas los enlaces pasan a un panel desplegable; la búsqueda se
 * abre debajo de la barra. Ambos se cierran con Escape y al navegar.
 */
export function StoreNav({
  storeName,
  links,
}: {
  storeName: string;
  links: StoreNavLink[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Cerrar los paneles al cambiar de página. Se compara durante el render en
  // lugar de usar un efecto, para no encadenar renders.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, searchOpen]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const iconButton =
    "grid size-10 place-items-center rounded-full text-[#f5f5f7]/80 transition-colors hover:text-white";

  return (
    <header className="sticky top-0 z-50 bg-[#161617]/85 backdrop-blur-xl backdrop-saturate-150">
      <nav aria-label="Principal" className="mx-auto flex h-12 max-w-[1280px] items-center gap-2 px-3 sm:px-6">
        <Link
          href="/tienda"
          className="mr-2 rounded px-2 text-[16px] font-semibold tracking-[-0.02em] text-white"
        >
          {storeName}
        </Link>

        <ul className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {links.map((link) => {
            const active = isActive(link.href, pathname, searchParams);

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded px-3 py-2 text-[12px] tracking-[-0.01em] transition-colors hover:text-white",
                    active ? "text-white" : "text-[#f5f5f7]/80",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center md:ml-0">
          <button
            type="button"
            className={iconButton}
            aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar"}
            aria-expanded={searchOpen}
            onClick={() => {
              setSearchOpen((open) => !open);
              setMenuOpen(false);
            }}
          >
            {searchOpen ? <X className="size-[18px]" aria-hidden /> : <Search className="size-[18px]" aria-hidden />}
          </button>

          {/* Acceso del personal: presente pero discreto, no compite con la tienda. */}
          <Link
            href="/login"
            className={cn(iconButton, "opacity-40 hover:opacity-100 focus-visible:opacity-100")}
            aria-label="Acceso del personal"
            title="Acceso del personal"
          >
            <Lock className="size-4" aria-hidden />
          </Link>

          <button
            type="button"
            className={cn(iconButton, "md:hidden")}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            aria-controls="store-menu"
            onClick={() => {
              setMenuOpen((open) => !open);
              setSearchOpen(false);
            }}
          >
            {menuOpen ? <X className="size-[18px]" aria-hidden /> : <Menu className="size-[18px]" aria-hidden />}
          </button>
        </div>
      </nav>

      {searchOpen ? (
        <div className="border-t border-white/10 bg-[#161617]">
          <form
            action="/tienda/catalogo"
            method="get"
            role="search"
            className="mx-auto flex max-w-[980px] items-center gap-3 px-5 py-4 sm:px-8"
          >
            <Search className="size-5 shrink-0 text-[#86868b]" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              name="search"
              placeholder="Buscar por marca, modelo o color"
              aria-label="Buscar en la tienda"
              maxLength={80}
              className="h-10 w-full bg-transparent text-[21px] tracking-[-0.02em] text-white placeholder:text-[#86868b] focus:outline-none"
            />
          </form>
        </div>
      ) : null}

      {menuOpen ? (
        <div id="store-menu" className="border-t border-white/10 bg-[#161617] md:hidden">
          <ul className="mx-auto max-w-[980px] px-5 py-3">
            {links.map((link) => (
              <li key={link.href} className="border-b border-white/10 last:border-0">
                <Link
                  href={link.href}
                  className="block py-3 text-[19px] font-semibold tracking-[-0.02em] text-[#f5f5f7]"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
