import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessoryCategory, FinancingType, PaymentMethod } from "@prisma/client";
import { testDb, resetDatabase, seedFixtures, type Fixtures } from "./helpers/db";
import { actAs } from "./helpers/session";
import {
  adjustAccessoryStock,
  createAccessory,
  deactivateAccessory,
} from "@/lib/services/accessories";
import { cancelSale, createSale } from "@/lib/services/sales";

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

async function givenAccessory(stock: number, price = 10_000): Promise<string> {
  const { id } = await createAccessory({
    category: AccessoryCategory.FUNDA,
    name: "Funda de prueba",
    brand: undefined,
    sku: undefined,
    salePrice: price,
    minStock: 5,
    notes: undefined,
    initialStock: stock,
  });
  return id;
}

const baseSale = {
  deviceIds: [],
  accessoryItems: [],
  discount: 0,
  paymentMethod: PaymentMethod.EFECTIVO,
  financingType: FinancingType.CONTADO,
  installmentCount: null,
  firstDueDate: null,
  notes: undefined,
  customerId: undefined,
};

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await testDb.$disconnect();
});

describe("Alta de accesorios", () => {
  it("crea el accesorio con su stock inicial y deja el movimiento de ingreso", async () => {
    const id = await givenAccessory(20);

    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id } });
    expect(accessory.stockQuantity).toBe(20);
    expect(accessory.isActive).toBe(true);

    const movement = await testDb.stockMovement.findFirstOrThrow({
      where: { accessoryId: id },
    });
    expect(movement.type).toBe("INGRESO");
    expect(movement.quantityDelta).toBe(20);
    expect(movement.quantityAfter).toBe(20);
    // Un movimiento de accesorio no afecta a ningún equipo.
    expect(movement.deviceId).toBeNull();
  });

  it("un vendedor no puede crear accesorios", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });
    await expect(givenAccessory(10)).rejects.toThrow(/No tenés permisos/);
  });

  it("la base rechaza un stock negativo", async () => {
    const id = await givenAccessory(5);

    await expect(
      testDb.accessory.update({ where: { id }, data: { stockQuantity: -1 } }),
    ).rejects.toThrow(/accessories_stock_non_negative/);
  });
});

describe("Ajuste de stock", () => {
  it("suma stock y registra el movimiento con el resultado", async () => {
    const id = await givenAccessory(10);

    await adjustAccessoryStock(id, { quantityDelta: 5, reason: "Ingreso de mercadería" });

    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id } });
    expect(accessory.stockQuantity).toBe(15);

    const movement = await testDb.stockMovement.findFirstOrThrow({
      where: { accessoryId: id, type: "AJUSTE_POSITIVO" },
    });
    expect(movement.quantityDelta).toBe(5);
    expect(movement.quantityAfter).toBe(15);
  });

  it("descuenta stock y lo audita", async () => {
    const id = await givenAccessory(10);

    await adjustAccessoryStock(id, { quantityDelta: -3, reason: "Rotura en el mostrador" });

    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id } });
    expect(accessory.stockQuantity).toBe(7);

    const audit = await testDb.auditLog.findFirstOrThrow({
      where: { entityId: id, action: "AJUSTE_STOCK" },
    });
    expect(audit.changes).toMatchObject({ stock: { anterior: 10, nuevo: 7 } });
  });

  it("no deja descontar más de lo que hay", async () => {
    const id = await givenAccessory(3);

    await expect(
      adjustAccessoryStock(id, { quantityDelta: -5, reason: "Intento inválido" }),
    ).rejects.toThrow(/No hay stock suficiente/);

    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id } });
    expect(accessory.stockQuantity).toBe(3);
  });

  it("un vendedor no puede ajustar stock manualmente", async () => {
    const id = await givenAccessory(10);
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(
      adjustAccessoryStock(id, { quantityDelta: 5, reason: "Intento del vendedor" }),
    ).rejects.toThrow(/No tenés permisos/);
  });
});

describe("Venta de accesorios", () => {
  it("descuenta el stock vendido y registra el movimiento", async () => {
    const id = await givenAccessory(10, 10_000);

    const sale = await createSale({
      ...baseSale,
      accessoryItems: [{ accessoryId: id, quantity: 3 }],
    });

    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id } });
    expect(accessory.stockQuantity).toBe(7);

    const stored = await testDb.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(Number(stored.total)).toBe(30_000);

    const item = await testDb.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });
    expect(item.quantity).toBe(3);
    expect(Number(item.lineTotal)).toBe(30_000);
    expect(item.deviceId).toBeNull();

    const movement = await testDb.stockMovement.findFirstOrThrow({
      where: { accessoryId: id, type: "VENTA" },
    });
    expect(movement.quantityDelta).toBe(-3);
    expect(movement.quantityAfter).toBe(7);
  });

  it("no permite vender más unidades de las que hay en stock", async () => {
    const id = await givenAccessory(2);

    await expect(
      createSale({ ...baseSale, accessoryItems: [{ accessoryId: id, quantity: 5 }] }),
    ).rejects.toThrow(/No hay stock suficiente/);

    // Ni la venta ni el descuento de stock deben haber ocurrido.
    expect(await testDb.sale.count()).toBe(0);
    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id } });
    expect(accessory.stockQuantity).toBe(2);
  });

  it("no permite vender un accesorio dado de baja", async () => {
    const id = await givenAccessory(10);
    await deactivateAccessory(id, "Producto discontinuado");

    await expect(
      createSale({ ...baseSale, accessoryItems: [{ accessoryId: id, quantity: 1 }] }),
    ).rejects.toThrow(/dado de baja/);
  });

  it("permite vender un equipo y accesorios en la misma operación", async () => {
    const { createDevice } = await import("@/lib/services/devices");
    const { deviceInput } = await import("./helpers/db");

    const device = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 500_000 }),
    );
    const accessoryId = await givenAccessory(10, 10_000);

    const sale = await createSale({
      ...baseSale,
      deviceIds: [device.id],
      accessoryItems: [{ accessoryId, quantity: 2 }],
    });

    const stored = await testDb.sale.findUniqueOrThrow({ where: { id: sale.id } });
    // 500.000 del equipo + 2 × 10.000 de accesorios.
    expect(Number(stored.total)).toBe(520_000);

    expect(await testDb.saleItem.count({ where: { saleId: sale.id } })).toBe(2);

    const soldDevice = await testDb.device.findUniqueOrThrow({ where: { id: device.id } });
    expect(soldDevice.inventoryStatus).toBe("VENDIDO");

    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id: accessoryId } });
    expect(accessory.stockQuantity).toBe(8);
  });

  it("revierte todo si el equipo falla, sin tocar el stock del accesorio", async () => {
    const { createDevice } = await import("@/lib/services/devices");
    const { deviceInput } = await import("./helpers/db");

    const device = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }),
    );
    const accessoryId = await givenAccessory(10);

    // Se vende el equipo por separado para que quede indisponible.
    await createSale({ ...baseSale, deviceIds: [device.id] });

    await expect(
      createSale({
        ...baseSale,
        deviceIds: [device.id],
        accessoryItems: [{ accessoryId, quantity: 4 }],
      }),
    ).rejects.toThrow(/ya fue vendido/);

    // El accesorio no debe haber perdido stock.
    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id: accessoryId } });
    expect(accessory.stockQuantity).toBe(10);
  });
});

describe("Anulación con accesorios", () => {
  it("devuelve las unidades al stock y crea el movimiento inverso", async () => {
    const id = await givenAccessory(10);

    const sale = await createSale({
      ...baseSale,
      accessoryItems: [{ accessoryId: id, quantity: 4 }],
    });

    expect((await testDb.accessory.findUniqueOrThrow({ where: { id } })).stockQuantity).toBe(6);

    await cancelSale(sale.id, { reason: "El cliente devolvió las fundas" });

    const accessory = await testDb.accessory.findUniqueOrThrow({ where: { id } });
    expect(accessory.stockQuantity).toBe(10);

    const movement = await testDb.stockMovement.findFirstOrThrow({
      where: { accessoryId: id, type: "DEVOLUCION" },
    });
    expect(movement.quantityDelta).toBe(4);
    expect(movement.quantityAfter).toBe(10);
  });
});
