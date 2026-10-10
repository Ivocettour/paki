import { PrismaClient } from "@prisma/client";
import type { CreateDeviceInput } from "@/lib/validations/device";

/**
 * Los tests de integración corren contra una base propia (`paki_test`), nunca
 * contra la de desarrollo. La URL se toma de TEST_DATABASE_URL.
 */
const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/paki_test?schema=public";

if (!/paki_test/.test(url)) {
  throw new Error(
    "TEST_DATABASE_URL debe apuntar a una base de test (nombre con 'paki_test'). " +
      "Se aborta para no destruir datos reales.",
  );
}

export const testDb = new PrismaClient({ datasources: { db: { url } } });

/// Vacía todas las tablas respetando el orden de claves foráneas.
export async function resetDatabase(): Promise<void> {
  // Las consultas arrastran sus mensajes, notas y borradores (cascada).
  await testDb.staffNotification.deleteMany();
  await testDb.webhookLog.deleteMany();
  await testDb.lead.deleteMany();
  await testDb.auditLog.deleteMany();
  await testDb.stockMovement.deleteMany();
  await testDb.installment.deleteMany();
  await testDb.saleItem.deleteMany();
  await testDb.sale.deleteMany();
  // Los ítems de compra referencian accesorios y equipos: se borran antes.
  await testDb.purchaseItem.deleteMany();
  await testDb.purchase.deleteMany();
  await testDb.accessory.deleteMany();
  await testDb.device.deleteMany(); // arrastra sus fotos (cascada)
  await testDb.deviceModel.deleteMany(); // arrastra su imagen (cascada)
  await testDb.brand.deleteMany();
  await testDb.financingPlan.deleteMany();
  await testDb.customer.deleteMany();
  await testDb.supplier.deleteMany();
  await testDb.user.deleteMany();
}

export interface Fixtures {
  adminId: string;
  sellerId: string;
  modelId: string;
  brandId: string;
}

/// Datos mínimos comunes a los tests: un administrador, un vendedor y un modelo.
export async function seedFixtures(): Promise<Fixtures> {
  const admin = await testDb.user.create({
    data: {
      firstName: "Ada",
      lastName: "Admin",
      email: "admin@test.com",
      passwordHash: "hash-de-prueba",
      role: "ADMINISTRADOR",
    },
  });

  const seller = await testDb.user.create({
    data: {
      firstName: "Vera",
      lastName: "Vendedora",
      email: "vendedor@test.com",
      passwordHash: "hash-de-prueba",
      role: "VENDEDOR",
    },
  });

  const brand = await testDb.brand.create({ data: { name: "Apple" } });
  const model = await testDb.deviceModel.create({
    data: { brandId: brand.id, name: "iPhone 15", minStock: 2 },
  });

  return { adminId: admin.id, sellerId: seller.id, modelId: model.id, brandId: brand.id };
}

/// `modelId` es obligatorio porque depende de las fixtures de cada test.
export function deviceInput(
  overrides: Partial<CreateDeviceInput> & { modelId: string },
): CreateDeviceInput {
  return {
    color: "Negro",
    storageGb: 128,
    condition: "NUEVO_SELLADO" as const,
    batteryPercent: null,
    imei: "350001000000018",
    serialNumber: undefined,
    purchasePrice: 500_000,
    salePrice: 700_000,
    entryDate: new Date("2026-01-15"),
    notes: undefined,
    requiresImei: true,
    ...overrides,
  };
}
