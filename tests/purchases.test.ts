import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessoryCategory, DeviceCondition, DeviceType } from "@prisma/client";
import { testDb, resetDatabase, seedFixtures, type Fixtures } from "./helpers/db";
import { actAs } from "./helpers/session";
import { createAccessory } from "@/lib/services/accessories";
import { createSupplier } from "@/lib/services/suppliers";
import {
  cancelPurchase,
  confirmPurchase,
  createPurchase,
} from "@/lib/services/purchases";

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
let supplierId: string;

function deviceItem(overrides: Record<string, unknown> = {}) {
  return {
    kind: "equipo" as const,
    modelId: fixtures.modelId,
    deviceType: DeviceType.CELULAR,
    color: "Negro",
    storageGb: 128,
    condition: DeviceCondition.NUEVO_SELLADO,
    batteryPercent: null,
    imei: "350001000000018",
    serialNumber: undefined,
    unitCost: 400_000,
    salePrice: 600_000,
    ...overrides,
  };
}

async function givenAccessory(stock = 5): Promise<string> {
  const { id } = await createAccessory({
    category: AccessoryCategory.FUNDA,
    name: "Funda de prueba",
    brand: undefined,
    sku: undefined,
    salePrice: 15_000,
    minStock: 0,
    notes: undefined,
    initialStock: stock,
  });
  return id;
}

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });

  const supplier = await createSupplier({
    name: "Distribuidora de prueba",
    cuit: undefined,
    phone: undefined,
    email: undefined,
    address: undefined,
    notes: undefined,
  });
  supplierId = supplier.id;
});

afterAll(async () => {
  vi.restoreAllMocks();
  await testDb.$disconnect();
});

describe("Alta de compras", () => {
  it("crea la compra en borrador SIN tocar el inventario", async () => {
    const accessoryId = await givenAccessory(5);

    const purchase = await createPurchase({
      supplierId,
      purchaseDate: new Date(2026, 5, 10),
      notes: undefined,
      items: [deviceItem(), { kind: "accesorio", accessoryId, quantity: 10, unitCost: 8_000 }],
    });

    expect(purchase.purchaseNumber).toMatch(/^C-\d{8}$/);

    const stored = await testDb.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(stored.status).toBe("BORRADOR");
    // 400.000 del equipo + 10 × 8.000 de accesorios.
    expect(Number(stored.total)).toBe(480_000);

    // Nada ingresó todavía.
    expect(await testDb.device.count()).toBe(0);
    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id: accessoryId } });
    expect(accessory.stockQuantity).toBe(5);
  });

  it("rechaza un IMEI repetido dentro de la misma compra", async () => {
    await expect(
      createPurchase({
        supplierId,
        purchaseDate: new Date(),
        notes: undefined,
        items: [deviceItem(), deviceItem()],
      }),
    ).rejects.toThrow(/IMEI repetido/);

    expect(await testDb.purchase.count()).toBe(0);
  });

  it("no permite comprar un accesorio dado de baja", async () => {
    const accessoryId = await givenAccessory();
    const { deactivateAccessory } = await import("@/lib/services/accessories");
    await deactivateAccessory(accessoryId, "Discontinuado");

    await expect(
      createPurchase({
        supplierId,
        purchaseDate: new Date(),
        notes: undefined,
        items: [{ kind: "accesorio", accessoryId, quantity: 5, unitCost: 8_000 }],
      }),
    ).rejects.toThrow(/dado de baja/);
  });

  it("un vendedor no puede registrar compras", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(
      createPurchase({
        supplierId,
        purchaseDate: new Date(),
        notes: undefined,
        items: [deviceItem()],
      }),
    ).rejects.toThrow(/No tenés permisos/);
  });
});

describe("Confirmación: ingreso automático de stock", () => {
  it("crea los equipos en el inventario con su movimiento de ingreso", async () => {
    const purchase = await createPurchase({
      supplierId,
      purchaseDate: new Date(2026, 5, 10),
      notes: undefined,
      items: [deviceItem()],
    });

    await confirmPurchase(purchase.id);

    const device = await testDb.device.findFirstOrThrow({
      where: { imei: "350001000000018" },
    });
    expect(device.inventoryStatus).toBe("DISPONIBLE");
    // El costo de la compra queda como precio de compra del equipo.
    expect(Number(device.purchasePrice)).toBe(400_000);
    expect(Number(device.salePrice)).toBe(600_000);
    // La fecha de ingreso es la de la compra, no la de hoy.
    expect(device.entryDate.getFullYear()).toBe(2026);

    const movement = await testDb.stockMovement.findFirstOrThrow({
      where: { deviceId: device.id, type: "INGRESO" },
    });
    expect(movement.reason).toContain(purchase.purchaseNumber);

    // El ítem queda enlazado al equipo creado, para poder rastrearlo.
    const item = await testDb.purchaseItem.findFirstOrThrow({
      where: { purchaseId: purchase.id },
    });
    expect(item.deviceId).toBe(device.id);
  });

  it("suma las unidades al stock del accesorio", async () => {
    const accessoryId = await givenAccessory(5);

    const purchase = await createPurchase({
      supplierId,
      purchaseDate: new Date(),
      notes: undefined,
      items: [{ kind: "accesorio", accessoryId, quantity: 20, unitCost: 8_000 }],
    });

    await confirmPurchase(purchase.id);

    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id: accessoryId } });
    expect(accessory.stockQuantity).toBe(25);

    const movement = await testDb.stockMovement.findFirstOrThrow({
      where: { accessoryId, type: "INGRESO", quantityDelta: 20 },
    });
    expect(movement.quantityAfter).toBe(25);
  });

  it("no deja confirmar dos veces", async () => {
    const purchase = await createPurchase({
      supplierId,
      purchaseDate: new Date(),
      notes: undefined,
      items: [deviceItem()],
    });

    await confirmPurchase(purchase.id);
    await expect(confirmPurchase(purchase.id)).rejects.toThrow(/ya fue confirmada/);

    // No se duplicó el ingreso.
    expect(await testDb.device.count()).toBe(1);
  });

  it("revierte todo si un IMEI ya existe en el inventario", async () => {
    const accessoryId = await givenAccessory(5);

    // Se confirma una primera compra que deja el IMEI ocupado.
    const primera = await createPurchase({
      supplierId,
      purchaseDate: new Date(),
      notes: undefined,
      items: [deviceItem()],
    });
    await confirmPurchase(primera.id);

    // La segunda repite el IMEI y además trae accesorios.
    const segunda = await createPurchase({
      supplierId,
      purchaseDate: new Date(),
      notes: undefined,
      items: [
        { kind: "accesorio", accessoryId, quantity: 10, unitCost: 8_000 },
        deviceItem(),
      ],
    });

    await expect(confirmPurchase(segunda.id)).rejects.toThrow(/IMEI/);

    // El stock del accesorio NO debe haberse tocado, aunque su ítem venía primero.
    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id: accessoryId } });
    expect(accessory.stockQuantity).toBe(5);

    // Y la compra sigue en borrador.
    const stored = await testDb.purchase.findUniqueOrThrow({ where: { id: segunda.id } });
    expect(stored.status).toBe("BORRADOR");
    expect(await testDb.device.count()).toBe(1);
  });

  it("ingresa equipos y accesorios en una sola operación", async () => {
    const accessoryId = await givenAccessory(3);

    const purchase = await createPurchase({
      supplierId,
      purchaseDate: new Date(),
      notes: undefined,
      items: [
        deviceItem(),
        deviceItem({ imei: "350001000000026", color: "Azul" }),
        { kind: "accesorio", accessoryId, quantity: 12, unitCost: 8_000 },
      ],
    });

    await confirmPurchase(purchase.id);

    expect(await testDb.device.count()).toBe(2);
    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id: accessoryId } });
    expect(accessory.stockQuantity).toBe(15);

    const audit = await testDb.auditLog.findFirstOrThrow({
      where: { entityId: purchase.id, action: "CONFIRMAR_COMPRA" },
    });
    expect(audit.changes).toMatchObject({
      equiposIngresados: { nuevo: 2 },
      unidadesDeAccesorios: { nuevo: 12 },
    });
  });
});

describe("Anulación de compras", () => {
  it("anula una compra en borrador", async () => {
    const purchase = await createPurchase({
      supplierId,
      purchaseDate: new Date(),
      notes: undefined,
      items: [deviceItem()],
    });

    await cancelPurchase(purchase.id, { reason: "El proveedor no entregó" });

    const stored = await testDb.purchase.findUniqueOrThrow({ where: { id: purchase.id } });
    expect(stored.status).toBe("ANULADA");
    expect(await testDb.device.count()).toBe(0);
  });

  it("NO permite anular una compra ya confirmada", async () => {
    const purchase = await createPurchase({
      supplierId,
      purchaseDate: new Date(),
      notes: undefined,
      items: [deviceItem()],
    });
    await confirmPurchase(purchase.id);

    await expect(
      cancelPurchase(purchase.id, { reason: "Intento de anulación" }),
    ).rejects.toThrow(/no puede anularse/);

    // El equipo ingresado sigue en el inventario.
    expect(await testDb.device.count()).toBe(1);
  });

  it("no permite confirmar una compra anulada", async () => {
    const purchase = await createPurchase({
      supplierId,
      purchaseDate: new Date(),
      notes: undefined,
      items: [deviceItem()],
    });
    await cancelPurchase(purchase.id, { reason: "El proveedor no entregó" });

    await expect(confirmPurchase(purchase.id)).rejects.toThrow(/está anulada/);
  });
});

describe("Proveedores", () => {
  it("rechaza un nombre de proveedor repetido", async () => {
    await expect(
      createSupplier({
        name: "Distribuidora de prueba",
        cuit: undefined,
        phone: undefined,
        email: undefined,
        address: undefined,
        notes: undefined,
      }),
    ).rejects.toThrow(/Ya existe un proveedor/);
  });

  it("un vendedor no puede gestionar proveedores", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(
      createSupplier({
        name: "Otro proveedor",
        cuit: undefined,
        phone: undefined,
        email: undefined,
        address: undefined,
        notes: undefined,
      }),
    ).rejects.toThrow(/No tenés permisos/);
  });
});
