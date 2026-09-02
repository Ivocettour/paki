import { describe, expect, it } from "vitest";
import { UserRole } from "@prisma/client";
import { can, PERMISSIONS, permissionsFor } from "@/lib/auth/permissions";
import { navigationFor } from "@/lib/navigation";

describe("Matriz de permisos", () => {
  it("el administrador tiene acceso completo", () => {
    for (const permission of PERMISSIONS) {
      expect(can(UserRole.ADMINISTRADOR, permission)).toBe(true);
    }
  });

  it("el vendedor puede registrar ventas y consultar inventario", () => {
    expect(can(UserRole.VENDEDOR, "ventas.registrar")).toBe(true);
    expect(can(UserRole.VENDEDOR, "inventario.ver")).toBe(true);
    expect(can(UserRole.VENDEDOR, "ventas.ver_propias")).toBe(true);
    expect(can(UserRole.VENDEDOR, "clientes.crear")).toBe(true);
  });

  it.each([
    ["inventario.editar_precio", "modificar precios"],
    ["inventario.crear", "crear productos"],
    ["inventario.editar", "editar productos"],
    ["inventario.dar_de_baja", "eliminar productos"],
    ["stock.ajustar", "modificar stock manualmente"],
    ["usuarios.crear", "crear usuarios"],
    ["usuarios.editar", "modificar usuarios"],
    ["usuarios.desactivar", "desactivar usuarios"],
    ["ventas.anular", "anular ventas"],
    ["auditoria.ver", "ver auditoría"],
    ["configuracion.ver", "ver configuración sensible"],
  ] as const)("el vendedor NO puede %s (%s)", (permission, _descripcion) => {
    expect(can(UserRole.VENDEDOR, permission)).toBe(false);
  });

  it("el vendedor no accede a precios de compra ni al valor del inventario", () => {
    expect(can(UserRole.VENDEDOR, "inventario.ver_precio_compra")).toBe(false);
    expect(can(UserRole.VENDEDOR, "dashboard.ver_metricas_economicas")).toBe(false);
  });

  it("el vendedor no consulta movimientos de stock", () => {
    expect(can(UserRole.VENDEDOR, "stock.ver_movimientos")).toBe(false);
  });

  it("un rol ausente no tiene ningún permiso", () => {
    expect(can(null, "inventario.ver")).toBe(false);
    expect(can(undefined, "ventas.registrar")).toBe(false);
  });

  it("los permisos del vendedor son un subconjunto estricto de los del administrador", () => {
    const adminPermissions = new Set(permissionsFor(UserRole.ADMINISTRADOR));
    const sellerPermissions = permissionsFor(UserRole.VENDEDOR);

    expect(sellerPermissions.length).toBeLessThan(adminPermissions.size);
    for (const permission of sellerPermissions) {
      expect(adminPermissions.has(permission)).toBe(true);
    }
  });
});

describe("Navegación por rol", () => {
  it("el administrador ve todas las secciones", () => {
    const labels = navigationFor(UserRole.ADMINISTRADOR).flatMap((section) =>
      section.items.map((item) => item.label),
    );

    expect(labels).toEqual(
      expect.arrayContaining([
        "Dashboard",
        "Equipos",
        "Accesorios",
        "Ventas",
        "Cuotas",
        "Clientes",
        "Movimientos",
        "Compras",
        "Reportes",
        "Usuarios",
        "Auditoría",
        "Configuración",
      ]),
    );
  });

  it("el vendedor solo ve las secciones operativas permitidas", () => {
    const labels = navigationFor(UserRole.VENDEDOR).flatMap((section) =>
      section.items.map((item) => item.label),
    );

    expect(labels).toEqual([
      "Dashboard",
      "Equipos",
      "Accesorios",
      "Ventas",
      "Cuotas",
      "Clientes",
    ]);
  });

  it("no se exponen secciones administrativas al vendedor", () => {
    const hrefs = navigationFor(UserRole.VENDEDOR).flatMap((section) =>
      section.items.map((item) => item.href),
    );

    for (const restricted of ["/usuarios", "/auditoria", "/configuracion", "/movimientos"]) {
      expect(hrefs).not.toContain(restricted);
    }
  });
});
