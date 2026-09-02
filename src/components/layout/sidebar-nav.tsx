"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarClock,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Receipt,
  Settings,
  ShieldCheck,
  Truck,
  Building2,
  Users,
  UsersRound,
} from "lucide-react";
import type { NavIcon, NavSection } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/// Los componentes de ícono viven del lado del cliente; el servidor solo envía
/// el nombre.
const ICONS: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  inventario: Package,
  accesorios: Headphones,
  ventas: Receipt,
  cuotas: CalendarClock,
  clientes: UsersRound,
  movimientos: ArrowLeftRight,
  compras: Truck,
  proveedores: Building2,
  reportes: ClipboardList,
  usuarios: Users,
  auditoria: ShieldCheck,
  configuracion: Settings,
};

export function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
      {sections.map((section, index) => (
        <div key={section.title ?? index} className={cn(index > 0 && "mt-6")}>
          {section.title ? (
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary">
              {section.title}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              // "/" solo coincide exacto; el resto también con sus subrutas.
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = ICONS[item.icon];

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] transition-colors",
                      isActive
                        ? "bg-surface-raised text-fg font-medium shadow-[0_1px_2px_rgb(0_0_0_/_0.05)]"
                        : "text-fg-secondary hover:bg-surface-raised/60 hover:text-fg",
                    )}
                  >
                    <Icon
                      className={cn("size-[18px] shrink-0", isActive && "text-accent")}
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
