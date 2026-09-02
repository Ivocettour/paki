import type { UserRole } from "@prisma/client";

/// Catálogo único de permisos del sistema.
/// La UI y las rutas de servidor consultan esta misma matriz: ocultar un botón
/// nunca alcanza, toda operación se vuelve a validar en el servidor.
export const PERMISSIONS = [
  "dashboard.ver",
  "dashboard.ver_metricas_economicas",

  "inventario.ver",
  "inventario.crear",
  "inventario.editar",
  "inventario.dar_de_baja",
  "inventario.editar_precio",
  "inventario.ver_precio_compra",

  "stock.ver_movimientos",
  "stock.ajustar",

  "ventas.ver_todas",
  "ventas.ver_propias",
  "ventas.registrar",
  "ventas.anular",

  "clientes.ver",
  "clientes.crear",
  "clientes.editar",

  "cuotas.ver",
  "cuotas.registrar_pago",
  "cuotas.anular_pago",

  "usuarios.ver",
  "usuarios.crear",
  "usuarios.editar",
  "usuarios.desactivar",

  "auditoria.ver",
  "reportes.ver",
  "reportes.exportar",

  "proveedores.ver",
  "proveedores.gestionar",
  "compras.ver",
  "compras.gestionar",

  "configuracion.ver",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const VENDEDOR_PERMISSIONS: readonly Permission[] = [
  "dashboard.ver",
  "inventario.ver",
  "ventas.ver_propias",
  "ventas.registrar",
  "clientes.ver",
  "clientes.crear",
  // Cobrar una cuota en el mostrador es una operación de venta, no una
  // corrección: el vendedor puede registrarla y queda auditada a su nombre.
  // Anular un cobro sí es corrección, y queda reservado al administrador.
  "cuotas.ver",
  "cuotas.registrar_pago",
];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  // El administrador tiene acceso completo.
  ADMINISTRADOR: PERMISSIONS,
  VENDEDOR: VENDEDOR_PERMISSIONS,
};

export function can(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(
  role: UserRole | undefined | null,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => can(role, permission));
}

export function permissionsFor(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
