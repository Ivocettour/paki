import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FinancingType, PaymentMethod } from "@prisma/client";
import { testDb, resetDatabase, seedFixtures, deviceInput, type Fixtures } from "./helpers/db";
import { actAs } from "./helpers/session";
import { createDevice } from "@/lib/services/devices";
import { cancelSale, createSale, getSaleDetail } from "@/lib/services/sales";

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

/// Crea un equipo disponible y devuelve su id.
async function givenAvailableDevice(imei: string, salePrice = 700_000): Promise<string> {
  const { id } = await createDevice(
    deviceInput({ modelId: fixtures.modelId, imei, salePrice }),
  );
  return id;
}

const baseSale = {
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

describe("Registro de venta", () => {
  it("vende un equipo disponible y actualiza inventario, stock y auditoría", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");

    const sale = await createSale({ ...baseSale, deviceIds: [deviceId] });

    expect(sale.saleNumber).toMatch(/^V-\d{8}$/);

    // El equipo queda vendido.
    const device = await testDb.device.findUniqueOrThrow({ where: { id: deviceId } });
    expect(device.inventoryStatus).toBe("VENDIDO");

    // Queda el ítem con el precio congelado.
    const item = await testDb.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });
    expect(Number(item.unitPrice)).toBe(700_000);

    // Y el movimiento de stock correspondiente.
    const movement = await testDb.stockMovement.findFirstOrThrow({
      where: { deviceId, type: "VENTA" },
    });
    expect(movement.saleId).toBe(sale.id);
    expect(movement.previousStatus).toBe("DISPONIBLE");
    expect(movement.newStatus).toBe("VENDIDO");
    expect(movement.userId).toBe(fixtures.adminId);

    const audit = await testDb.auditLog.findFirstOrThrow({
      where: { entityId: sale.id, action: "REGISTRAR_VENTA" },
    });
    expect(audit.userId).toBe(fixtures.adminId);
  });

  it("no permite vender dos veces el mismo equipo", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");
    await createSale({ ...baseSale, deviceIds: [deviceId] });

    await expect(createSale({ ...baseSale, deviceIds: [deviceId] })).rejects.toThrow(
      /ya fue vendido/,
    );

    expect(await testDb.sale.count()).toBe(1);
  });

  it("toma el precio de la base, no el que envíe el cliente", async () => {
    const deviceId = await givenAvailableDevice("350001000000018", 700_000);

    // Se intenta colar un precio manipulado en la petición.
    const sale = await createSale({
      ...baseSale,
      deviceIds: [deviceId],
      ...({ unitPrice: 1, subtotal: 1, total: 1 } as object),
    });

    const stored = await testDb.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(Number(stored.total)).toBe(700_000);
  });

  it("revierte la venta entera si un equipo del lote no está disponible", async () => {
    const disponible = await givenAvailableDevice("350001000000018");
    const vendido = await givenAvailableDevice("350001000000026");
    await createSale({ ...baseSale, deviceIds: [vendido] });

    await expect(
      createSale({ ...baseSale, deviceIds: [disponible, vendido] }),
    ).rejects.toThrow(/ya fue vendido/);

    // El equipo que sí estaba disponible no debe haberse tocado.
    const device = await testDb.device.findUniqueOrThrow({ where: { id: disponible } });
    expect(device.inventoryStatus).toBe("DISPONIBLE");
    expect(await testDb.sale.count()).toBe(1);
  });

  it("rechaza un descuento mayor al subtotal", async () => {
    const deviceId = await givenAvailableDevice("350001000000018", 500_000);

    await expect(
      createSale({ ...baseSale, deviceIds: [deviceId], discount: 600_000 }),
    ).rejects.toThrow(/descuento no puede superar/);

    expect(await testDb.sale.count()).toBe(0);
  });

  it("asigna comprobantes correlativos y únicos", async () => {
    const first = await givenAvailableDevice("350001000000018");
    const second = await givenAvailableDevice("350001000000026");

    const saleA = await createSale({ ...baseSale, deviceIds: [first] });
    const saleB = await createSale({ ...baseSale, deviceIds: [second] });

    expect(saleA.saleNumber).not.toBe(saleB.saleNumber);
  });

  it("un vendedor puede registrar ventas", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    const sale = await createSale({ ...baseSale, deviceIds: [deviceId] });

    const stored = await testDb.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(stored.sellerId).toBe(fixtures.sellerId);
  });
});

describe("Financiación", () => {
  it("la financiación propia del local genera las cuotas a cobrar", async () => {
    const deviceId = await givenAvailableDevice("350001000000018", 900_000);

    const sale = await createSale({
      ...baseSale,
      deviceIds: [deviceId],
      financingType: FinancingType.FINANCIACION_LOCAL,
      installmentCount: 3,
      firstDueDate: new Date(2026, 9, 10),
    });

    const installments = await testDb.installment.findMany({
      where: { saleId: sale.id },
      orderBy: { number: "asc" },
    });

    expect(installments).toHaveLength(3);
    expect(installments.every((item) => item.status === "PENDIENTE")).toBe(true);

    // La suma de las cuotas coincide exactamente con el total.
    const sum = installments.reduce((acc, item) => acc + Number(item.amount), 0);
    expect(sum).toBeCloseTo(900_000, 2);
  });

  it("la venta en cuotas con tarjeta NO genera deuda del cliente", async () => {
    const deviceId = await givenAvailableDevice("350001000000018", 900_000);

    const sale = await createSale({
      ...baseSale,
      deviceIds: [deviceId],
      paymentMethod: PaymentMethod.CREDITO,
      financingType: FinancingType.TARJETA,
      installmentCount: 6,
    });

    // Se registra en cuántas cuotas se hizo, pero no hay cuotas a reclamar.
    const stored = await testDb.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(stored.installmentCount).toBe(6);
    expect(await testDb.installment.count({ where: { saleId: sale.id } })).toBe(0);
  });

  it("la venta al contado no registra cantidad de cuotas", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");

    const sale = await createSale({ ...baseSale, deviceIds: [deviceId] });

    const stored = await testDb.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(stored.installmentCount).toBeNull();
  });
});

describe("Anulación de venta", () => {
  it("devuelve el equipo al inventario y crea el movimiento inverso", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");
    const sale = await createSale({ ...baseSale, deviceIds: [deviceId] });

    await cancelSale(sale.id, { reason: "El cliente se arrepintió" });

    const stored = await testDb.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(stored.status).toBe("ANULADA");
    expect(stored.cancelledById).toBe(fixtures.adminId);
    expect(stored.cancellationReason).toBe("El cliente se arrepintió");
    expect(stored.cancelledAt).not.toBeNull();

    const device = await testDb.device.findUniqueOrThrow({ where: { id: deviceId } });
    expect(device.inventoryStatus).toBe("DISPONIBLE");

    const movement = await testDb.stockMovement.findFirstOrThrow({
      where: { deviceId, type: "DEVOLUCION" },
    });
    expect(movement.previousStatus).toBe("VENDIDO");
    expect(movement.newStatus).toBe("DISPONIBLE");
  });

  it("conserva la venta original en el historial", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");
    const sale = await createSale({ ...baseSale, deviceIds: [deviceId] });

    await cancelSale(sale.id, { reason: "Error de carga en el comprobante" });

    // Ni la venta ni sus ítems ni sus movimientos se eliminan.
    expect(await testDb.sale.count()).toBe(1);
    expect(await testDb.saleItem.count({ where: { saleId: sale.id } })).toBe(1);
    expect(await testDb.stockMovement.count({ where: { saleId: sale.id } })).toBe(2);
  });

  it("el equipo devuelto puede volver a venderse", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");
    const first = await createSale({ ...baseSale, deviceIds: [deviceId] });
    await cancelSale(first.id, { reason: "El cliente se arrepintió" });

    const second = await createSale({ ...baseSale, deviceIds: [deviceId] });

    expect(second.id).not.toBe(first.id);
    const device = await testDb.device.findUniqueOrThrow({ where: { id: deviceId } });
    expect(device.inventoryStatus).toBe("VENDIDO");
  });

  it("no revierte un equipo que después fue dado de baja", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");
    const sale = await createSale({ ...baseSale, deviceIds: [deviceId] });

    // Baja administrativa posterior a la venta.
    await testDb.device.update({
      where: { id: deviceId },
      data: { inventoryStatus: "INACTIVO" },
    });

    await cancelSale(sale.id, { reason: "Anulación administrativa" });

    // Se respeta la baja: no vuelve a DISPONIBLE.
    const device = await testDb.device.findUniqueOrThrow({ where: { id: deviceId } });
    expect(device.inventoryStatus).toBe("INACTIVO");
  });

  it("anula las cuotas pendientes y conserva las ya cobradas", async () => {
    const deviceId = await givenAvailableDevice("350001000000018", 900_000);
    const sale = await createSale({
      ...baseSale,
      deviceIds: [deviceId],
      financingType: FinancingType.FINANCIACION_LOCAL,
      installmentCount: 3,
      firstDueDate: new Date(2026, 9, 10),
    });

    const first = await testDb.installment.findFirstOrThrow({
      where: { saleId: sale.id, number: 1 },
    });
    await testDb.installment.update({
      where: { id: first.id },
      data: {
        status: "PAGADA",
        paidAt: new Date(),
        paidAmount: first.amount,
        registeredById: fixtures.adminId,
      },
    });

    await cancelSale(sale.id, { reason: "Anulación con cuota ya cobrada" });

    const installments = await testDb.installment.findMany({
      where: { saleId: sale.id },
      orderBy: { number: "asc" },
    });

    expect(installments[0].status).toBe("PAGADA");
    expect(installments[1].status).toBe("ANULADA");
    expect(installments[2].status).toBe("ANULADA");
  });

  it("no permite anular dos veces", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");
    const sale = await createSale({ ...baseSale, deviceIds: [deviceId] });
    await cancelSale(sale.id, { reason: "Primera anulación" });

    await expect(cancelSale(sale.id, { reason: "Segunda anulación" })).rejects.toThrow(
      /ya está anulada/,
    );
  });

  it("un vendedor no puede anular ventas", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");
    const sale = await createSale({ ...baseSale, deviceIds: [deviceId] });

    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(cancelSale(sale.id, { reason: "Intento del vendedor" })).rejects.toThrow(
      /No tenés permisos/,
    );

    const stored = await testDb.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(stored.status).toBe("COMPLETADA");
  });
});

describe("Acceso a las ventas", () => {
  it("un vendedor no puede abrir la venta de otro", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");
    // La venta la registra el administrador.
    const sale = await createSale({ ...baseSale, deviceIds: [deviceId] });

    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(getSaleDetail(sale.id)).rejects.toThrow(/tus propias ventas/);
  });

  it("un vendedor sí puede abrir la venta que registró", async () => {
    const deviceId = await givenAvailableDevice("350001000000018");
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    const sale = await createSale({ ...baseSale, deviceIds: [deviceId] });
    const detail = await getSaleDetail(sale.id);

    expect(detail.saleNumber).toBe(sale.saleNumber);
  });
});
