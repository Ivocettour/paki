import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb, resetDatabase, seedFixtures, deviceInput, type Fixtures } from "./helpers/db";
import { actAs } from "./helpers/session";
import { createDevice } from "@/lib/services/devices";
import {
  createBrand,
  createDeviceModel,
  deleteBrand,
  deleteDeviceModel,
  getCatalogOverview,
  updateBrand,
  updateDeviceModel,
} from "@/lib/services/catalog";

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

beforeEach(async () => {
  await resetDatabase();
  fixtures = await seedFixtures();
  actAs({ id: fixtures.adminId, role: "ADMINISTRADOR" });
});

afterAll(async () => {
  vi.restoreAllMocks();
  await testDb.$disconnect();
});

describe("Marcas", () => {
  it("crea una marca y la audita", async () => {
    const { id } = await createBrand({ name: "Motorola" });

    const brand = await testDb.brand.findUniqueOrThrow({ where: { id } });
    expect(brand.name).toBe("Motorola");

    const audit = await testDb.auditLog.findFirstOrThrow({
      where: { entityId: id, entity: "Brand" },
    });
    expect(audit.action).toBe("MODIFICAR_CONFIGURACION");
    expect(audit.userId).toBe(fixtures.adminId);
  });

  it("rechaza una marca repetida", async () => {
    await expect(createBrand({ name: "Apple" })).rejects.toThrow(/Ya existe una marca/);
  });

  it("renombrar una marca alcanza a sus equipos", async () => {
    await createDevice(deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }));

    await updateBrand(fixtures.brandId, { name: "Apple Inc." });

    // El equipo no se toca: apunta al mismo modelo, que apunta a la marca.
    const device = await testDb.device.findFirstOrThrow({
      include: { model: { include: { brand: true } } },
    });
    expect(device.model.brand.name).toBe("Apple Inc.");
  });

  it("no permite eliminar una marca con modelos", async () => {
    await expect(deleteBrand(fixtures.brandId)).rejects.toThrow(/modelo asociado/);

    // Sigue existiendo.
    expect(await testDb.brand.count({ where: { id: fixtures.brandId } })).toBe(1);
  });

  it("permite eliminar una marca vacía, para corregir una carga por error", async () => {
    const { id } = await createBrand({ name: "Marca con typo" });

    await deleteBrand(id);

    expect(await testDb.brand.count({ where: { id } })).toBe(0);
  });

  it("un vendedor no puede tocar el catálogo", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(createBrand({ name: "Nokia" })).rejects.toThrow(/No tenés permisos/);
    await expect(deleteBrand(fixtures.brandId)).rejects.toThrow(/No tenés permisos/);
  });
});

describe("Modelos", () => {
  it("crea un modelo bajo su marca", async () => {
    const { id } = await createDeviceModel({
      brandId: fixtures.brandId,
      name: "iPhone 16",
      minStock: 3,
    });

    const model = await testDb.deviceModel.findUniqueOrThrow({ where: { id } });
    expect(model.name).toBe("iPhone 16");
    expect(model.minStock).toBe(3);
    expect(model.brandId).toBe(fixtures.brandId);
  });

  it("rechaza un modelo repetido dentro de la misma marca", async () => {
    await expect(
      createDeviceModel({ brandId: fixtures.brandId, name: "iPhone 15", minStock: 0 }),
    ).rejects.toThrow(/Ya existe un modelo/);
  });

  it("permite el mismo nombre de modelo en marcas distintas", async () => {
    const otra = await createBrand({ name: "Otra marca" });

    await createDeviceModel({ brandId: otra.id, name: "iPhone 15", minStock: 0 });

    expect(await testDb.deviceModel.count({ where: { name: "iPhone 15" } })).toBe(2);
  });

  it("actualiza el stock mínimo y lo audita", async () => {
    await updateDeviceModel(fixtures.modelId, {
      brandId: fixtures.brandId,
      name: "iPhone 15",
      minStock: 7,
    });

    const model = await testDb.deviceModel.findUniqueOrThrow({
      where: { id: fixtures.modelId },
    });
    expect(model.minStock).toBe(7);

    const audit = await testDb.auditLog.findFirstOrThrow({
      where: { entityId: fixtures.modelId, entity: "DeviceModel" },
    });
    expect(audit.changes).toMatchObject({ minStock: { anterior: 2, nuevo: 7 } });
  });

  it("no permite eliminar un modelo con equipos cargados", async () => {
    await createDevice(deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }));

    await expect(deleteDeviceModel(fixtures.modelId)).rejects.toThrow(
      /equipo asociado|equipos asociados/,
    );

    // Ni el modelo ni el equipo se pierden.
    expect(await testDb.deviceModel.count({ where: { id: fixtures.modelId } })).toBe(1);
    expect(await testDb.device.count()).toBe(1);
  });

  it("permite eliminar un modelo que nunca se usó", async () => {
    const { id } = await createDeviceModel({
      brandId: fixtures.brandId,
      name: "Modelo con typo",
      minStock: 0,
    });

    await deleteDeviceModel(id);

    expect(await testDb.deviceModel.count({ where: { id } })).toBe(0);
  });

  it("no permite eliminar un modelo que aparece en una compra", async () => {
    const { createSupplier } = await import("@/lib/services/suppliers");
    const { createPurchase } = await import("@/lib/services/purchases");

    const supplier = await createSupplier({
      name: "Proveedor",
      cuit: undefined,
      phone: undefined,
      email: undefined,
      address: undefined,
      notes: undefined,
    });

    const model = await createDeviceModel({
      brandId: fixtures.brandId,
      name: "Modelo comprado",
      minStock: 0,
    });

    // La compra queda en borrador: ni siquiera hace falta confirmarla.
    await createPurchase({
      supplierId: supplier.id,
      purchaseDate: new Date(),
      notes: undefined,
      items: [
        {
          kind: "equipo",
          modelId: model.id,
          deviceType: "CELULAR",
          color: "Negro",
          storageGb: 128,
          condition: "NUEVO_SELLADO",
          batteryPercent: null,
          imei: "350001000000018",
          serialNumber: undefined,
          unitCost: 100,
          salePrice: 200,
        },
      ],
    });

    await expect(deleteDeviceModel(model.id)).rejects.toThrow(/compras registradas/);
  });
});

describe("Vista del catálogo", () => {
  it("informa cuántos equipos tiene cada modelo y cuáles se pueden borrar", async () => {
    await createDevice(deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }));
    const vacio = await createDeviceModel({
      brandId: fixtures.brandId,
      name: "Sin usar",
      minStock: 0,
    });

    const catalog = await getCatalogOverview();
    const brand = catalog.find((b) => b.id === fixtures.brandId)!;

    const usado = brand.models.find((m) => m.id === fixtures.modelId)!;
    expect(usado.deviceCount).toBe(1);
    expect(usado.availableCount).toBe(1);
    expect(usado.canDelete).toBe(false);

    const sinUsar = brand.models.find((m) => m.id === vacio.id)!;
    expect(sinUsar.deviceCount).toBe(0);
    expect(sinUsar.canDelete).toBe(true);

    // La marca tiene modelos, así que no se puede borrar.
    expect(brand.canDelete).toBe(false);
  });

  it("no cuenta como disponibles los equipos vendidos", async () => {
    const device = await createDevice(
      deviceInput({ modelId: fixtures.modelId, imei: "350001000000018" }),
    );
    await testDb.device.update({
      where: { id: device.id },
      data: { inventoryStatus: "VENDIDO" },
    });

    const catalog = await getCatalogOverview();
    const model = catalog
      .flatMap((brand) => brand.models)
      .find((m) => m.id === fixtures.modelId)!;

    expect(model.deviceCount).toBe(1);
    expect(model.availableCount).toBe(0);
  });

  it("un vendedor no puede ver la configuración", async () => {
    actAs({ id: fixtures.sellerId, role: "VENDEDOR" });

    await expect(getCatalogOverview()).rejects.toThrow(/No tenés permisos/);
  });
});
