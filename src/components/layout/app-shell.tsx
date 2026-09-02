"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { UserRole } from "@prisma/client";
import type { NavSection } from "@/lib/navigation";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";

interface AppShellProps {
  sections: NavSection[];
  user: { firstName: string; lastName: string; email: string; role: UserRole };
  children: React.ReactNode;
}

export function AppShell({ sections, user, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <>
      <div className="flex h-16 items-center px-6">
        <Link href="/" className="text-[17px] font-semibold tracking-[-0.02em] text-fg">
          Gestión
        </Link>
      </div>
      <SidebarNav sections={sections} onNavigate={() => setMobileOpen(false)} />
    </>
  );

  return (
    <div className="min-h-dvh bg-surface-subtle">
      {/*
        Salto al contenido: sin esto, quien navega con teclado tiene que
        recorrer todo el menú en cada pantalla. Solo se ve al enfocarlo.
      */}
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>

      {/* Sidebar fijo en escritorio */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line-subtle bg-surface-muted lg:flex">
        {sidebar}
      </aside>

      {/* Sidebar deslizante en mobile */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface-muted shadow-[var(--shadow-overlay)]">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-4 grid size-8 place-items-center rounded-full text-fg-secondary hover:bg-surface-subtle"
            >
              <X className="size-4" aria-hidden />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <header
          className={cn(
            "sticky top-0 z-20 flex h-16 items-center justify-between gap-4 px-4 sm:px-6",
            "border-b border-line-subtle bg-surface-muted/85 backdrop-blur-xl",
          )}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="grid size-9 place-items-center rounded-full text-fg-secondary hover:bg-surface-subtle lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>

          <div className="flex-1" />

          <UserMenu
            firstName={user.firstName}
            lastName={user.lastName}
            email={user.email}
            role={user.role}
          />
        </header>

        <main id="contenido" tabIndex={-1} className="px-4 py-8 sm:px-6 lg:px-10">
          <div className="mx-auto max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
