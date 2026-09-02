import type { UserRole } from "@prisma/client";
import { can, type Permission } from "@/lib/auth/permissions";

/// Los íconos se identifican por nombre, no por componente: este módulo lo
/// consume un Server Component y los componentes de React no son serializables
/// a través de la frontera servidor/cliente.
export type NavIcon =
  | "dashboard"
  | "inventario"
  | "accesorios"
  | "ventas"
  | "cuotas"
  | "clientes"
  | "movimientos"
  | "compras"
  | "proveedores"
  | "reportes"
  | "usuarios"
  | "auditoria"
  | "configuracion";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  permission: Permission;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/", label: "Dashboard", icon: "dashboard", permission: "dashboard.ver" },
      { href: "/inventario", label: "Equipos", icon: "inventario", permission: "inventario.ver" },
      {
        href: "/accesorios",
        label: "Accesorios",
        icon: "accesorios",
        permission: "inventario.ver",
      },
      { href: "/ventas", label: "Ventas", icon: "ventas", permission: "ventas.ver_propias" },
      { href: "/cuotas", label: "Cuotas", icon: "cuotas", permission: "cuotas.ver" },
      { href: "/clientes", label: "Clientes", icon: "clientes", permission: "clientes.ver" },
    ],
  },
  {
    title: "Operaciones",
    items: [
      {
        href: "/movimientos",
        label: "Movimientos",
        icon: "movimientos",
        permission: "stock.ver_movimientos",
      },
      { href: "/compras", label: "Compras", icon: "compras", permission: "compras.ver" },
      {
        href: "/proveedores",
        label: "Proveedores",
        icon: "proveedores",
        permission: "proveedores.ver",
      },
      { href: "/reportes", label: "Reportes", icon: "reportes", permission: "reportes.ver" },
    ],
  },
  {
    title: "Administración",
    items: [
      { href: "/usuarios", label: "Usuarios", icon: "usuarios", permission: "usuarios.ver" },
      { href: "/auditoria", label: "Auditoría", icon: "auditoria", permission: "auditoria.ver" },
      {
        href: "/configuracion",
        label: "Configuración",
        icon: "configuracion",
        permission: "configuracion.ver",
      },
    ],
  },
];

/// Devuelve solo las secciones con al menos un ítem permitido para el rol.
export function navigationFor(role: UserRole): NavSection[] {
  return SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(role, item.permission)),
  })).filter((section) => section.items.length > 0);
}
