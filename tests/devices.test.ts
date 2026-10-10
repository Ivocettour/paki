import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb, resetDatabase, seedFixtures, deviceInput, type Fixtures } from "./helpers/db";
import { actAs, actAsNobody } from "./helpers/session";
import {
  createDevice,
  updateDevice,
  deactivateDevice,
  listDevices,
} from "@/lib/services/devices";
import { AppError } from "@/lib/errors";

// Los servicios apuntan a la base de test y a la sesión simulada.
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
      if (user.role !== "ADMINISTRADOR") {
        throw errors.sinPermisos("Esta acción es exclusiva de administradores.");
      }
      return user;
    },
  };
});

let fixtures: Fixtures;

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await testDb.$disconnect();
});

describe("Alta de celulares", () => {
  it("crea el equipo, lo deja disponible y registra ingreso y auditoría", async () => {
    const { id } = await createDevice(deviceInput({ modelId: fixtures.modelId }));

    const device = await testDb.device.findUniqueOrThrow({ where: { id } });
    expect(device.inventoryStatus).toBe("DISPONIBLE");
    expect(device.imei).toBe("350001000000018");
    expect(device.createdById).toBe(fixtures.adminId);

    // Todo ingreso al inventario deja movimiento de stock.
    const movements = await testDb.stockMovement.findMany({ where: { deviceId: id } });
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe("INGRESO");
    expect(movements[0].userId).toBe(fixtures.adminId);

    const audit = await testDb.auditLog.findMany({ where: { entityId: id } });
    expect(audit).toHaveLength(1);
    expect(audit[0].action).toBe("CREAR_PRODUCTO");
  });

  it("acepta un equipo nuevo sin sellar, sin batería declarada", async () => {
    const { id } = await createDevice(
      deviceInput({ modelId: fixtures.modelId, condition: "NUEVO_SIN_SELLAR" }),
    );

    const device = await testDb.device.findUniqueOrThrow({ where: { id } });
    expect(device.condition).toBe("NUEVO_SIN_SELLAR");
    expect(device.batteryPercent).toBeNull();
  });

  it("rechaza un IMEI duplicado con un mensaje del dominio", async () => {
    await createDevice(deviceInput({ modelId: fixtures.modelId }));

    await expect(
      createDevice(deviceInput({ modelId: fixtures.modelId, salePrice: 900_000 })),
    ).rejects.toThrow(/El IMEI ingresado ya existe/);

    expect(await testDb.device.count()).toBe(1);
  });

  it("no deja rastro cuando el alta falla: la transacción se revierte entera", async () => {
    await createDevice(deviceInput({ modelId: fixtures.modelId }));

    await expect(
      createDevice(deviceInput({ modelId: fixtures.modelId })),
    ).rejects.toThrow(AppError);

    // Del intento fallido no debe quedar ni movimiento ni auditoría.
    expect(await testDb.stockMovement.count()).toBe(1);
    expect(await testDb.auditLog.count()).toBe(1);
  });

  it("la base rechaza un equipo usado sin porcentaje de batería", async () => {
    // Se escribe directo contra la base para verificar el CHECK constraint,
    // sin pasar por la validación de la aplicación.
    await expect(
      testDb.device.create({
        data: {
          modelId: fixtures.modelId,
          color: "Negro",
          storageGb: 128,
          condition: "USADO",
          batteryPercent: null,
          imei: "350001000000026",
          salePrice: 500_000,
          createdById: fixtures.adminId,
        },
      }),
    ).rejects.toThrow(/devices_used_requires_battery/);
  });

  it("la base rechaza una batería fuera del rango 0-100", async () => {
    await expect(
      testDb.device.create({
        data: {
          modelId: fixtures.modelId,
          color: "Negro",
          storageGb: 128,
          condition: "USADO",
          batteryPercent: 120,
          imei: "350001000000034",
          salePrice: 500_000,
          createdById: fixtures.adminId,
        },
      }),
    ).rejects.toThrow(/devices_battery_percent_range/);
  });
});

describe("Permisos sobre el inventario", () => {
  it("un vendedor no puede crear equipos", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(createDevice(deviceInput({ modelId: fixtures.modelId }))).rejects.toThrow(
      /No tenés permisos/,
    );
    expect(await testDb.device.count()).toBe(0);
  });

  it("un vendedor no puede dar de baja equipos", async () => {
    const { id } = await createDevice(deviceInput({ modelId: fixtures.modelId }));
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(deactivateDevice(id, { reason: "prueba", forceSold: false })).rejects.toThrow(
      /No tenés permisos/,
    );
  });

  it("sin sesión no se accede al inventario", async () => {
    actAsNobody();
    await expect(listDevices({ page: 1, sortBy: "entryDate", sortDir: "desc" })).rejects.toThrow(
      /iniciar sesión/,
    );
  });

  it("el vendedor no recibe el precio de compra en el listado", async () => {
    await createDevice(deviceInput({ modelId: fixtures.modelId }));
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    const result = await listDevices({ page: 1, sortBy: "entryDate", sortDir: "desc" });

    expect(result.canSeePurchasePrice).toBe(false);
    expect(result.items[0].purchasePrice).toBeNull();
  });
});

describe("Modificación de precio", () => {
  it("audita el precio anterior y el nuevo", async () => {
    const { id } = await createDevice(deviceInput({ modelId: fixtures.modelId }));

    await updateDevice(id, {
      ...deviceInput({ modelId: fixtures.modelId }),
      salePrice: 850_000,
      inventoryStatus: "DISPONIBLE",
    });

    const priceAudit = await testDb.auditLog.findFirst({
      where: { entityId: id, action: "MODIFICAR_PRECIO" },
    });

    expect(priceAudit).not.toBeNull();
    expect(priceAudit?.changes).toEqual({
      salePrice: { anterior: 700_000, nuevo: 850_000 },
    });
    expect(priceAudit?.userId).toBe(fixtures.adminId);
  });

  it("no registra auditoría cuando no cambió nada", async () => {
    const { id } = await createDevice(deviceInput({ modelId: fixtures.modelId }));
    const before = await testDb.auditLog.count();

    await updateDevice(id, {
      ...deviceInput({ modelId: fixtures.modelId }),
      inventoryStatus: "DISPONIBLE",
    });

    expect(await testDb.auditLog.count()).toBe(before);
  });
});

describe("Baja lógica", () => {
  it("marca el equipo como INACTIVO sin borrarlo y deja movimiento y auditoría", async () => {
    const { id } = await createDevice(deviceInput({ modelId: fixtures.modelId }));

    await deactivateDevice(id, { reason: "Falla irreparable", forceSold: false });

    const device = await testDb.device.findUniqueOrThrow({ where: { id } });
    expect(device.inventoryStatus).toBe("INACTIVO");

    const movement = await testDb.stockMovement.findFirst({
      where: { deviceId: id, type: "BAJA" },
    });
    expect(movement?.reason).toBe("Falla irreparable");
    expect(movement?.previousStatus).toBe("DISPONIBLE");
    expect(movement?.newStatus).toBe("INACTIVO");

    const audit = await testDb.auditLog.findFirst({
      where: { entityId: id, action: "BAJA_PRODUCTO" },
    });
    expect(audit).not.toBeNull();
  });

  it("no permite dar de baja dos veces", async () => {
    const { id } = await createDevice(deviceInput({ modelId: fixtures.modelId }));
    await deactivateDevice(id, { reason: "Falla irreparable", forceSold: false });

    await expect(
      deactivateDevice(id, { reason: "Otra vez", forceSold: false }),
    ).rejects.toThrow(/ya está dado de baja/);
  });

  it("bloquea la baja de un equipo vendido salvo confirmación administrativa", async () => {
    const { id } = await createDevice(deviceInput({ modelId: fixtures.modelId }));
    await testDb.device.update({
      where: { id },
      data: { inventoryStatus: "VENDIDO" },
    });

    await expect(
      deactivateDevice(id, { reason: "Baja de vendido", forceSold: false }),
    ).rejects.toThrow(/venta asociada/);

    // Con la confirmación explícita sí procede.
    await deactivateDevice(id, { reason: "Baja administrativa", forceSold: true });

    const device = await testDb.device.findUniqueOrThrow({ where: { id } });
    expect(device.inventoryStatus).toBe("INACTIVO");
  });
});

describe("Búsqueda y filtros", () => {
  beforeEach(async () => {
    await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 700_000 }),
    );
    await createDevice(
      deviceInput({
        modelId: fixtures.modelId,
        imei: "350001000000026",
        condition: "USADO",
        batteryPercent: 88,
        salePrice: 500_000,
        color: "Azul",
      }),
    );
  });

  it("encuentra un equipo por IMEI exacto", async () => {
    const result = await listDevices({
      search: "350001000000026",
      page: 1,
      sortBy: "entryDate",
      sortDir: "desc",
    });

    expect(result.total).toBe(1);
    expect(result.items[0].imei).toBe("350001000000026");
  });

  it("encuentra un equipo por IMEI parcial", async () => {
    const result = await listDevices({
      search: "0000000",
      page: 1,
      sortBy: "entryDate",
      sortDir: "desc",
    });

    expect(result.total).toBe(2);
  });

  it("filtra por estado del equipo y por rango de precio", async () => {
    const usados = await listDevices({
      condition: "USADO",
      page: 1,
      sortBy: "entryDate",
      sortDir: "desc",
    });
    expect(usados.total).toBe(1);

    const caros = await listDevices({
      minPrice: 600_000,
      page: 1,
      sortBy: "entryDate",
      sortDir: "desc",
    });
    expect(caros.total).toBe(1);
    expect(caros.items[0].salePrice).toBe(700_000);
  });
});
