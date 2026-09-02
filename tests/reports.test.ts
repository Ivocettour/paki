import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessoryCategory, FinancingType, PaymentMethod } from "@prisma/client";
import { testDb, resetDatabase, seedFixtures, deviceInput, type Fixtures } from "./helpers/db";
import { actAs } from "./helpers/session";
import { createDevice } from "@/lib/services/devices";
import { createAccessory } from "@/lib/services/accessories";
import { cancelSale, createSale } from "@/lib/services/sales";
import {
  getInventoryReport,
  getLowStockReport,
  getMovementsReport,
  getSalesReport,
  getSoldProductsReport,
} from "@/lib/services/reports";

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

const baseFilters = { type: "ventas" as const };

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

describe("Reporte de inventario", () => {
  it("valoriza equipos y accesorios a precio de venta", async () => {
    await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 500_000 }),
    );
    await createAccessory({
      category: AccessoryCategory.FUNDA,
      name: "Funda",
      brand: undefined,
      sku: undefined,
      salePrice: 10_000,
      minStock: 0,
      notes: undefined,
      initialStock: 4,
    });

    const report = await getInventoryReport({ ...baseFilters, type: "inventario" });

    expect(report.summary.deviceCount).toBe(1);
    expect(report.summary.deviceValue).toBe(500_000);
    expect(report.summary.accessoryUnits).toBe(4);
    expect(report.summary.accessoryValue).toBe(40_000);
    expect(report.summary.totalValue).toBe(540_000);
  });

  it("no cuenta los equipos ya vendidos", async () => {
    const device = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 500_000 }),
    );
    await createSale({ ...baseSale, deviceIds: [device.id] });

    const report = await getInventoryReport({ ...baseFilters, type: "inventario" });

    expect(report.summary.deviceCount).toBe(0);
    expect(report.summary.deviceValue).toBe(0);
  });
});

describe("Reporte de ventas", () => {
  it("excluye las ventas anuladas de la facturación", async () => {
    const uno = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 100_000 }),
    );
    const dos = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000026", salePrice: 200_000 }),
    );

    await createSale({ ...baseSale, deviceIds: [uno.id] });
    const anulada = await createSale({ ...baseSale, deviceIds: [dos.id] });
    await cancelSale(anulada.id, { reason: "Prueba de anulación" });

    const report = await getSalesReport(baseFilters);

    expect(report.summary.completedCount).toBe(1);
    expect(report.summary.completedTotal).toBe(100_000);
    expect(report.summary.cancelledCount).toBe(1);
    expect(report.summary.cancelledTotal).toBe(200_000);

    // La anulada sigue apareciendo en el detalle, marcada como tal.
    expect(report.rows).toHaveLength(2);
  });

  it("calcula el ticket promedio sobre las ventas concretadas", async () => {
    const uno = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 100_000 }),
    );
    const dos = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000026", salePrice: 300_000 }),
    );

    await createSale({ ...baseSale, deviceIds: [uno.id] });
    await createSale({ ...baseSale, deviceIds: [dos.id] });

    const report = await getSalesReport(baseFilters);
    expect(report.summary.averageTicket).toBe(200_000);
  });

  it("no divide por cero cuando no hay ventas", async () => {
    const report = await getSalesReport(baseFilters);

    expect(report.summary.completedCount).toBe(0);
    expect(report.summary.averageTicket).toBe(0);
  });

  it("agrupa por vendedor y por método de pago", async () => {
    const device = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 100_000 }),
    );
    await createSale({
      ...baseSale,
      deviceIds: [device.id],
      paymentMethod: PaymentMethod.TRANSFERENCIA,
    });

    const report = await getSalesReport(baseFilters);

    expect(report.bySeller).toHaveLength(1);
    expect(report.bySeller[0].total).toBe(100_000);
    expect(report.byPaymentMethod[0].method).toBe("TRANSFERENCIA");
  });

  it("respeta el filtro por rango de fechas", async () => {
    const device = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 100_000 }),
    );
    const sale = await createSale({ ...baseSale, deviceIds: [device.id] });

    // Se lleva la venta al pasado para dejarla fuera del rango.
    await testDb.sale.update({
      where: { id: sale.id },
      data: { saleDate: new Date(2020, 0, 15) },
    });

    const dentro = await getSalesReport({
      ...baseFilters,
      dateFrom: new Date(2020, 0, 1),
      dateTo: new Date(2020, 0, 31),
    });
    expect(dentro.summary.completedCount).toBe(1);

    const fuera = await getSalesReport({
      ...baseFilters,
      dateFrom: new Date(2021, 0, 1),
    });
    expect(fuera.summary.completedCount).toBe(0);
  });

  it("el filtro 'hasta' incluye el día completo", async () => {
    const device = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 100_000 }),
    );
    const sale = await createSale({ ...baseSale, deviceIds: [device.id] });

    // Una venta a las 22:45 no debe quedar afuera al filtrar por ese mismo día.
    await testDb.sale.update({
      where: { id: sale.id },
      data: { saleDate: new Date(2026, 5, 10, 22, 45) },
    });

    const report = await getSalesReport({
      ...baseFilters,
      dateFrom: new Date(2026, 5, 10),
      dateTo: new Date(2026, 5, 10),
    });

    expect(report.summary.completedCount).toBe(1);
  });
});

describe("Reporte de productos vendidos", () => {
  it("suma unidades y facturación de equipos y accesorios", async () => {
    const device = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 500_000 }),
    );
    const { id: accessoryId } = await createAccessory({
      category: AccessoryCategory.FUNDA,
      name: "Funda",
      brand: undefined,
      sku: undefined,
      salePrice: 10_000,
      minStock: 0,
      notes: undefined,
      initialStock: 10,
    });

    await createSale({
      ...baseSale,
      deviceIds: [device.id],
      accessoryItems: [{ accessoryId, quantity: 3 }],
    });

    const report = await getSoldProductsReport(baseFilters);

    expect(report.summary.totalUnits).toBe(4); // 1 equipo + 3 accesorios
    expect(report.summary.totalRevenue).toBe(530_000);

    // Ordenado por facturación: primero el equipo.
    expect(report.rows[0].producto).toBe("Apple iPhone 15");
    expect(report.rows[1].unidades).toBe(3);
  });

  it("no cuenta lo vendido en ventas anuladas", async () => {
    const device = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018", salePrice: 500_000 }),
    );
    const sale = await createSale({ ...baseSale, deviceIds: [device.id] });
    await cancelSale(sale.id, { reason: "Prueba de anulación" });

    const report = await getSoldProductsReport(baseFilters);

    expect(report.summary.totalUnits).toBe(0);
    expect(report.rows).toHaveLength(0);
  });
});

describe("Reporte de stock bajo", () => {
  it("lista modelos y accesorios por debajo del mínimo", async () => {
    // El modelo de la fixture tiene minStock 2 y no hay equipos disponibles.
    await createAccessory({
      category: AccessoryCategory.TEMPLADO,
      name: "Templado",
      brand: undefined,
      sku: undefined,
      salePrice: 5_000,
      minStock: 10,
      notes: undefined,
      initialStock: 2,
    });

    const report = await getLowStockReport();

    const model = report.rows.find((row) => row.tipo === "EQUIPO");
    expect(model?.disponible).toBe(0);
    expect(model?.faltante).toBe(2);

    const accessory = report.rows.find((row) => row.tipo === "ACCESORIO");
    expect(accessory?.disponible).toBe(2);
    expect(accessory?.faltante).toBe(8);

    expect(report.summary.outOfStock).toBe(1);
  });

  it("ignora los productos sin mínimo configurado", async () => {
    await createAccessory({
      category: AccessoryCategory.CABLE,
      name: "Cable sin alerta",
      brand: undefined,
      sku: undefined,
      salePrice: 5_000,
      minStock: 0,
      notes: undefined,
      initialStock: 0,
    });

    const report = await getLowStockReport();

    expect(report.rows.some((row) => row.producto === "Cable sin alerta")).toBe(false);
  });
});

describe("Permisos de los reportes", () => {
  it("un vendedor no puede ver reportes", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(getSalesReport(baseFilters)).rejects.toThrow(/No tenés permisos/);
    await expect(getLowStockReport()).rejects.toThrow(/No tenés permisos/);
  });

  it("un vendedor no puede consultar los movimientos de stock", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(
      getMovementsReport({ ...baseFilters, type: "movimientos" }),
    ).rejects.toThrow(/No tenés permisos/);
  });
});
