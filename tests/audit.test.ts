import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb, resetDatabase, seedFixtures, deviceInput, type Fixtures } from "./helpers/db";
import { actAs } from "./helpers/session";
import { createDevice, updateDevice } from "@/lib/services/devices";
import { listAuditLog } from "@/lib/services/audit-log";
import { diffFields } from "@/lib/services/audit";

vi.mock("@/lib/db", async () => ({ prisma: (await import("./helpers/db")).testDb }));

vi.mock("@/lib/auth/session", async () => {
  const { errors } = await import("@/lib/errors");
  const { can } = await import("@/lib/auth/permissions");
  const { getMockedUser: current } = await import("./helpers/session");

  async function requireUser() {
    const user = current();
    if (!user) throw errors.noAutenticado();
    return user;
  }

  return {
    getCurrentUser: async () => current(),
    requireUser,
    requirePermission: async (permission: Parameters<typeof can>[1]) => {
      const user = await requireUser();
      if (!can(user.role, permission)) throw errors.sinPermisos();
      return user;
    },
    requireAdmin: async () => {
      const user = await requireUser();
      if (user.role !== "ADMINISTRADOR") throw errors.sinPermisos();
      return user;
    },
  };
});

let fixtures: Fixtures;

const noFilters = { page: 1 };

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await testDb.$disconnect();
});

describe("Comparación de campos", () => {
  it("solo reporta los campos que efectivamente cambiaron", () => {
    const changes = diffFields(
      { nombre: "Ana", precio: 100, activo: true },
      { nombre: "Ana", precio: 150, activo: true },
      ["nombre", "precio", "activo"],
    );

    expect(Object.keys(changes)).toEqual(["precio"]);
    expect(changes.precio).toEqual({ anterior: 100, nuevo: 150 });
  });

  it("ignora los campos ausentes en la actualización", () => {
    const changes = diffFields({ a: 1, b: 2 }, { a: 9 }, ["a", "b"]);
    expect(Object.keys(changes)).toEqual(["a"]);
  });

  it("distingue null de cero: un precio en 0 no es lo mismo que sin precio", () => {
    const sinValor: { v: number | null } = { v: null };

    expect(diffFields(sinValor, { v: 0 }, ["v"])).toHaveProperty("v");
    expect(diffFields(sinValor, { v: null }, ["v"])).toEqual({});
    expect(diffFields({ v: 0 as number | null }, { v: 0 }, ["v"])).toEqual({});
  });

  it("normaliza fechas para no reportar cambios inexistentes", () => {
    const fecha = new Date(2026, 5, 10);
    const changes = diffFields({ f: fecha }, { f: new Date(2026, 5, 10) }, ["f"]);
    expect(changes).toEqual({});
  });
});

describe("Consulta del registro de auditoría", () => {
  it("devuelve las entradas más recientes primero", async () => {
    const first = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }),
    );
    await createDevice(deviceInput({ modelId: fixtures.modelId, imei: "350001000000026" }));

    const result = await listAuditLog(noFilters);

    expect(result.total).toBe(2);
    // La primera fila es la última operación registrada.
    expect(result.items[0].entityId).not.toBe(first.id);
  });

  it("filtra por acción", async () => {
    const { id } = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }),
    );

    await updateDevice(id, {
      ...deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }),
      salePrice: 999_000,
      inventoryStatus: "DISPONIBLE",
    });

    const soloPrecios = await listAuditLog({ ...noFilters, action: "MODIFICAR_PRECIO" });

    expect(soloPrecios.total).toBe(1);
    expect(soloPrecios.items[0].changes).toEqual({
      salePrice: { anterior: 700_000, nuevo: 999_000 },
    });
  });

  it("filtra por el registro afectado, para ver su historial completo", async () => {
    const uno = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }),
    );
    await createDevice(deviceInput({ modelId: fixtures.modelId, imei: "350001000000026" }));

    const result = await listAuditLog({ ...noFilters, entityId: uno.id });

    expect(result.total).toBe(1);
    expect(result.items[0].entityId).toBe(uno.id);
  });

  it("filtra por usuario", async () => {
    await createDevice(deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }));

    const delAdmin = await listAuditLog({ ...noFilters, userId: fixtures.adminId });
    expect(delAdmin.total).toBe(1);

    const delVendedor = await listAuditLog({ ...noFilters, userId: fixtures.sellerId });
    expect(delVendedor.total).toBe(0);
  });

  it("filtra por rango de fechas", async () => {
    const { id } = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }),
    );

    // Se lleva la entrada al pasado.
    await testDb.auditLog.updateMany({
      where: { entityId: id },
      data: { createdAt: new Date(2020, 0, 15) },
    });

    const dentro = await listAuditLog({
      ...noFilters,
      dateFrom: new Date(2020, 0, 1),
      dateTo: new Date(2020, 0, 31),
    });
    expect(dentro.total).toBe(1);

    const fuera = await listAuditLog({ ...noFilters, dateFrom: new Date(2021, 0, 1) });
    expect(fuera.total).toBe(0);
  });

  it("agrupa la cantidad de entradas por acción", async () => {
    await createDevice(deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }));
    await createDevice(deviceInput({ modelId: fixtures.modelId, imei: "350001000000026" }));

    const result = await listAuditLog(noFilters);
    const creations = result.byAction.find((row) => row.action === "CREAR_PRODUCTO");

    expect(creations?.count).toBe(2);
  });

  it("un vendedor no puede consultar la auditoría", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(listAuditLog(noFilters)).rejects.toThrow(/No tenés permisos/);
  });
});

describe("Integridad del registro", () => {
  it("una modificación de precio queda con su valor anterior y el nuevo", async () => {
    const { id } = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 500_000 }),
    );

    await updateDevice(id, {
      ...deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }),
      salePrice: 850_000,
      inventoryStatus: "DISPONIBLE",
    });

    const entry = await testDb.auditLog.findFirstOrThrow({
      where: { entityId: id, action: "MODIFICAR_PRECIO" },
    });

    // Es exactamente el caso que pide el documento: saber quién tocó un precio.
    expect(entry.userId).toBe(fixtures.adminId);
    expect(entry.changes).toEqual({
      salePrice: { anterior: 500_000, nuevo: 850_000 },
    });
  });

  it("cada entrada queda atribuida a quien la hizo", async () => {
    await createDevice(deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }));

    const result = await listAuditLog(noFilters);
    expect(result.items[0].userId).toBe(fixtures.adminId);
    expect(result.items[0].userEmail).toBe("admin@test.com");
  });
});
