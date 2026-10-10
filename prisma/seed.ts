/**
 * Seed de datos para desarrollo.
 *
 * Las credenciales demo se toman de SEED_PASSWORD (ver .env.example).
 * El script se niega a correr contra una base de producción.
 */
import {
  Prisma,
  PrismaClient,
  DeviceCondition,
  FinancingType,
  InstallmentStatus,
  InventoryStatus,
  PaymentMethod,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildInstallmentPlan } from "../src/lib/domain/installments";

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD;

const DEMO_USERS = [
  { firstName: "Lucía", lastName: "Fernández", email: "lucia@local.com", role: "ADMINISTRADOR" },
  { firstName: "Martín", lastName: "Gómez", email: "martin@local.com", role: "ADMINISTRADOR" },
  { firstName: "Sofía", lastName: "Ramírez", email: "sofia@local.com", role: "VENDEDOR" },
  { firstName: "Diego", lastName: "Torres", email: "diego@local.com", role: "VENDEDOR" },
] as const;

const CATALOG: Record<string, { models: string[] }> = {
  Apple: { models: ["iPhone 13", "iPhone 14", "iPhone 15", "iPhone 15 Pro"] },
  Samsung: { models: ["Galaxy S23", "Galaxy S24", "Galaxy A54"] },
  Xiaomi: { models: ["Redmi Note 13", "Poco X6"] },
  Motorola: { models: ["Moto G84"] },
};

const COLORS = ["Negro", "Blanco", "Azul", "Titanio natural", "Verde", "Violeta"];

function randomOf<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/// Toma el próximo comprobante de la misma secuencia que usa la aplicación,
/// para que la numeración quede continua entre datos sembrados y reales.
async function nextSaleNumber(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval('sale_number_seq') AS nextval
  `;
  return `V-${String(rows[0].nextval).padStart(8, "0")}`;
}

/// Comprobante de compra desde la misma secuencia que usa la aplicación.
async function nextPurchaseNumber(client: PrismaClient): Promise<string> {
  const rows = await client.$queryRaw<Array<{ nextval: bigint }>>`
    SELECT nextval('purchase_number_seq') AS nextval
  `;
  return `C-${String(rows[0].nextval).padStart(8, "0")}`;
}

/// Primera cuota al mes siguiente de la venta.
function firstDueDate(saleDate: Date): Date {
  const date = new Date(saleDate);
  date.setMonth(date.getMonth() + 1);
  return date;
}

/// IMEIs sintéticos con dígito verificador Luhn válido, para que los datos
/// demo pasen las mismas validaciones que los reales.
function generateImei(seed: number): string {
  const base = `35${String(seed).padStart(12, "0")}`.slice(0, 14);
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    let digit = Number(base[13 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${base}${checkDigit}`;
}

/**
 * ¿La conexión apunta a una base local?
 *
 * Es la guarda que importa: `NODE_ENV` casi nunca vale "production" en la
 * máquina de quien desarrolla, así que por sí sola no impide apuntarle sin
 * querer a la base real. Lo que define el riesgo es el host, no el entorno.
 */
function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return ["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"].includes(
      hostname,
    );
  } catch {
    return false;
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const forced = Boolean(process.env.ALLOW_PRODUCTION_SEED);

  /*
   * El seed BORRA todo antes de sembrar. Si la conexión no es local, se
   * detiene: un `npm run db:seed` disparado por accidente con el .env de
   * producción cargado destruiría los datos reales del local.
   */
  if (!isLocalDatabase(databaseUrl) && !forced) {
    const host = (() => {
      try {
        return new URL(databaseUrl ?? "").hostname;
      } catch {
        return "desconocido";
      }
    })();

    throw new Error(
      `El seed BORRA todos los datos y la conexión no es local (host: ${host}).\n` +
        "Se detiene para no destruir información real.\n" +
        "Si de verdad querés sembrar esta base, definí ALLOW_PRODUCTION_SEED=1.",
    );
  }

  if (process.env.NODE_ENV === "production" && !forced) {
    throw new Error(
      "El seed no se ejecuta en producción. Definí ALLOW_PRODUCTION_SEED=1 si realmente lo necesitás.",
    );
  }

  if (!SEED_PASSWORD) {
    throw new Error("Falta la variable SEED_PASSWORD. Copiá .env.example a .env.");
  }

  console.log("Limpiando datos previos…");
  // El orden respeta las claves foráneas.
  await prisma.auditLog.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.installment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  // Los ítems de compra referencian accesorios y equipos: van primero.
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.accessory.deleteMany();
  await prisma.device.deleteMany();
  await prisma.deviceModel.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.financingPlan.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();

  // La numeración de comprobantes la lleva una secuencia de PostgreSQL, la
  // misma que usa la aplicación. Al vaciar las ventas hay que reiniciarla,
  // o los comprobantes que genere el seed chocarían con los de la app.
  await prisma.$executeRawUnsafe("ALTER SEQUENCE sale_number_seq RESTART WITH 1");
  await prisma.$executeRawUnsafe("ALTER SEQUENCE purchase_number_seq RESTART WITH 1");

  console.log("Creando usuarios…");
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const users = await Promise.all(
    DEMO_USERS.map((user) =>
      prisma.user.create({
        data: { ...user, passwordHash },
      }),
    ),
  );

  const admins = users.filter((user) => user.role === "ADMINISTRADOR");
  const sellers = users.filter((user) => user.role === "VENDEDOR");
  const [mainAdmin] = admins;

  console.log("Creando catálogo de marcas y modelos…");
  const modelIds: string[] = [];
  for (const [brandName, { models }] of Object.entries(CATALOG)) {
    const brand = await prisma.brand.create({ data: { name: brandName } });
    for (const modelName of models) {
      const model = await prisma.deviceModel.create({
        data: { brandId: brand.id, name: modelName, minStock: randomInt(1, 3) },
      });
      modelIds.push(model.id);
    }
  }

  console.log("Creando proveedores y clientes…");
  await prisma.supplier.createMany({
    data: [
      {
        name: "Distribuidora Central",
        cuit: "30-71234567-9",
        phone: "11 4444-5555",
        email: "ventas@distribuidoracentral.com",
        address: "Av. Corrientes 1234, CABA",
      },
      {
        name: "TecnoMayorista SRL",
        cuit: "30-70987654-3",
        phone: "11 3333-2222",
        email: "contacto@tecnomayorista.com",
        address: "San Martín 890, Rosario",
      },
    ],
  });

  const customers = await Promise.all(
    [
      { firstName: "Carla", lastName: "Medina", dni: "32456789", phone: "11 5555-1122" },
      { firstName: "Javier", lastName: "Sosa", dni: "28998877", phone: "11 5555-3344" },
      { firstName: "Ana", lastName: "Pereyra", dni: "35112233", email: "ana.pereyra@mail.com" },
    ].map((customer) =>
      prisma.customer.create({ data: { ...customer, createdById: mainAdmin.id } }),
    ),
  );

  console.log("Creando accesorios…");
  // Los accesorios se manejan por cantidad: un registro con stock.
  const ACCESSORIES = [
    { category: "FUNDA", name: "Funda silicona iPhone 15 negra", price: 18_000, stock: 24, min: 6 },
    { category: "FUNDA", name: "Funda transparente Galaxy S24", price: 15_000, stock: 18, min: 6 },
    { category: "TEMPLADO", name: "Vidrio templado iPhone 15", price: 9_500, stock: 40, min: 10 },
    { category: "TEMPLADO", name: "Vidrio templado Galaxy A54", price: 8_500, stock: 4, min: 10 },
    { category: "CARGADOR", name: "Cargador 20W USB-C", price: 22_000, stock: 12, min: 5 },
    { category: "CARGADOR", name: "Cargador inalámbrico 15W", price: 35_000, stock: 2, min: 4 },
    { category: "CABLE", name: "Cable USB-C a USB-C 1m", price: 7_500, stock: 30, min: 8 },
    { category: "AURICULARES", name: "Auriculares bluetooth genéricos", price: 45_000, stock: 9, min: 3 },
    { category: "PROTECTOR", name: "Protector de cámara iPhone 15", price: 6_000, stock: 0, min: 5 },
    { category: "BATERIA_EXTERNA", name: "Power bank 10.000 mAh", price: 58_000, stock: 7, min: 3 },
  ] as const;

  for (const item of ACCESSORIES) {
    const creator = randomOf(admins);
    const accessory = await prisma.accessory.create({
      data: {
        category: item.category,
        name: item.name,
        salePrice: item.price,
        stockQuantity: item.stock,
        minStock: item.min,
        createdById: creator.id,
      },
    });

    // No hay stock sin un movimiento que lo explique.
    if (item.stock > 0) {
      await prisma.stockMovement.create({
        data: {
          accessoryId: accessory.id,
          type: "INGRESO",
          reason: "Stock inicial del accesorio",
          userId: creator.id,
          quantityDelta: item.stock,
          quantityAfter: item.stock,
        },
      });
    }
  }

  console.log("Cargando planes de financiación…");
  await prisma.financingPlan.createMany({
    data: [
      { type: FinancingType.TARJETA, installments: 3, surchargePercent: 0 },
      { type: FinancingType.TARJETA, installments: 6, surchargePercent: 12 },
      { type: FinancingType.TARJETA, installments: 12, surchargePercent: 25 },
      { type: FinancingType.FINANCIACION_LOCAL, installments: 3, surchargePercent: 10 },
      { type: FinancingType.FINANCIACION_LOCAL, installments: 6, surchargePercent: 20 },
      { type: FinancingType.FINANCIACION_LOCAL, installments: 12, surchargePercent: 40 },
    ],
  });

  console.log("Creando inventario…");
  const devices = [];
  for (let i = 0; i < 40; i += 1) {
    const roll = Math.random();
    const condition =
      roll < 0.3
        ? DeviceCondition.NUEVO_SELLADO
        : roll < 0.45
          ? DeviceCondition.NUEVO_SIN_SELLAR
          : DeviceCondition.USADO;
    const isUsed = condition === DeviceCondition.USADO;
    const purchasePrice = randomInt(300, 900) * 1000;
    const creator = randomOf(admins);

    const device = await prisma.device.create({
      data: {
        modelId: randomOf(modelIds),
        color: randomOf(COLORS),
        storageGb: randomOf([64, 128, 256, 512]),
        condition,
        // La batería es obligatoria en usados; en equipos nuevos queda sin declarar.
        batteryPercent: isUsed ? randomInt(78, 100) : null,
        imei: generateImei(100000000 + i),
        serialNumber: `SN${randomInt(100000, 999999)}`,
        purchasePrice,
        salePrice: Math.round(purchasePrice * 1.35),
        entryDate: new Date(Date.now() - randomInt(0, 90) * 86_400_000),
        createdById: creator.id,
      },
    });

    // Todo equipo que entra al inventario deja su movimiento de INGRESO.
    await prisma.stockMovement.create({
      data: {
        deviceId: device.id,
        type: "INGRESO",
        reason: "Carga inicial de inventario",
        userId: creator.id,
        newStatus: InventoryStatus.DISPONIBLE,
        createdAt: device.entryDate,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: creator.id,
        action: "CREAR_PRODUCTO",
        entity: "Device",
        entityId: device.id,
        createdAt: device.entryDate,
      },
    });

    devices.push(device);
  }

  console.log("Registrando una compra pendiente de confirmar…");
  // Se deja en BORRADOR a propósito: así se puede probar la confirmación y ver
  // cómo la mercadería ingresa al inventario. Confirmarla NO altera los datos
  // que ya sembramos, los suma.
  const supplier = await prisma.supplier.findFirstOrThrow();
  const restockable = await prisma.accessory.findMany({ take: 2, orderBy: { name: "asc" } });
  const purchaseAdmin = randomOf(admins);

  const purchaseItems = [
    {
      modelId: randomOf(modelIds),
      deviceType: "CELULAR" as const,
      color: "Negro",
      storageGb: 256,
      condition: DeviceCondition.NUEVO_SELLADO,
      imei: generateImei(200000001),
      salePrice: 1_150_000,
      quantity: 1,
      unitCost: 820_000,
    },
    {
      modelId: randomOf(modelIds),
      deviceType: "CELULAR" as const,
      color: "Azul",
      storageGb: 128,
      condition: DeviceCondition.NUEVO_SELLADO,
      imei: generateImei(200000002),
      salePrice: 890_000,
      quantity: 1,
      unitCost: 640_000,
    },
    ...restockable.map((accessory, index) => ({
      accessoryId: accessory.id,
      quantity: index === 0 ? 24 : 30,
      unitCost: Math.round(Number(accessory.salePrice) * 0.55),
    })),
  ];

  const purchaseTotal = purchaseItems.reduce(
    (sum, item) => sum + item.unitCost * item.quantity,
    0,
  );

  await prisma.purchase.create({
    data: {
      purchaseNumber: await nextPurchaseNumber(prisma),
      supplierId: supplier.id,
      purchaseDate: new Date(Date.now() - 2 * 86_400_000),
      total: purchaseTotal,
      userId: purchaseAdmin.id,
      notes: "Remito 0001-00004821",
      items: { create: purchaseItems },
    },
  });

  console.log("Registrando ventas de ejemplo…");
  const soldDevices = devices.slice(0, 12);

  for (const [index, device] of soldDevices.entries()) {
    const seller = randomOf([...sellers, ...admins]);
    const customer = Math.random() < 0.7 ? randomOf(customers) : null;
    const unitPrice = Number(device.salePrice);
    const discount = Math.random() < 0.3 ? Math.round(unitPrice * 0.05) : 0;
    const total = unitPrice - discount;
    // Se reparten los tres tipos de financiación para poder ver el
    // recordatorio de cuotas con datos reales:
    //   - las primeras 4 ventas las financia el local (generan deuda),
    //   - las 3 siguientes son cuotas con tarjeta (sin deuda del cliente),
    //   - el resto es contado.
    const financingType =
      index < 4
        ? FinancingType.FINANCIACION_LOCAL
        : index < 7
          ? FinancingType.TARJETA
          : FinancingType.CONTADO;

    // Las ventas financiadas se fechan varios meses atrás para que su plan de
    // cuotas incluya vencimientos pasados y futuros: así el recordatorio
    // muestra cuotas vencidas, próximas y pagas.
    const saleDate =
      financingType === FinancingType.FINANCIACION_LOCAL
        ? new Date(Date.now() - randomInt(90, 240) * 86_400_000)
        : new Date(Date.now() - randomInt(0, 30) * 86_400_000);

    const installmentCount =
      financingType === FinancingType.CONTADO ? null : randomOf([3, 6, 12]);

    // Cada venta replica exactamente lo que hace el servicio real:
    // venta + ítem + cambio de estado + movimiento + auditoría, en una transacción.
    await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          saleNumber: await nextSaleNumber(tx),
          saleDate,
          sellerId: seller.id,
          customerId: customer?.id ?? null,
          subtotal: unitPrice,
          discount,
          total,
          paymentMethod:
            financingType === FinancingType.TARJETA
              ? PaymentMethod.CREDITO
              : randomOf([PaymentMethod.EFECTIVO, PaymentMethod.TRANSFERENCIA]),
          financingType,
          installmentCount,
          createdAt: saleDate,
        },
      });

      // Solo la financiación propia del local genera cuotas a cobrar.
      if (financingType === FinancingType.FINANCIACION_LOCAL && installmentCount) {
        // Se usa la misma función que la aplicación: el seed no reimplementa
        // reglas de negocio.
        const plan = buildInstallmentPlan(total, installmentCount, firstDueDate(saleDate));

        for (const item of plan) {
          // Las cuotas ya vencidas quedan mayormente pagas, y se deja alguna
          // impaga a propósito para que el recordatorio tenga qué mostrar.
          const isPast = item.dueDate < new Date();
          const paid = isPast && Math.random() < 0.6;

          await tx.installment.create({
            data: {
              saleId: sale.id,
              number: item.number,
              dueDate: item.dueDate,
              amount: item.amount,
              status: paid ? InstallmentStatus.PAGADA : InstallmentStatus.PENDIENTE,
              paidAt: paid ? item.dueDate : null,
              paidAmount: paid ? item.amount : null,
              paymentMethod: paid ? PaymentMethod.EFECTIVO : null,
              registeredById: paid ? seller.id : null,
            },
          });
        }
      }

      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          deviceId: device.id,
          unitPrice,
          discount,
          lineTotal: total,
        },
      });

      await tx.device.update({
        where: { id: device.id },
        data: { inventoryStatus: InventoryStatus.VENDIDO, updatedById: seller.id },
      });

      await tx.stockMovement.create({
        data: {
          deviceId: device.id,
          type: "VENTA",
          reason: `Venta ${sale.saleNumber}`,
          userId: seller.id,
          saleId: sale.id,
          previousStatus: InventoryStatus.DISPONIBLE,
          newStatus: InventoryStatus.VENDIDO,
          createdAt: saleDate,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: seller.id,
          action: "REGISTRAR_VENTA",
          entity: "Sale",
          entityId: sale.id,
          // Mismo formato {anterior, nuevo} que usa la aplicación.
          changes: {
            comprobante: { anterior: null, nuevo: sale.saleNumber },
            total: { anterior: null, nuevo: total },
            equipos: { anterior: null, nuevo: 1 },
          },
          createdAt: saleDate,
        },
      });
    });

  }

  console.log("\n✅ Seed completado");
  console.table({
    Usuarios: users.length,
    Modelos: modelIds.length,
    Equipos: devices.length,
    Ventas: soldDevices.length,
    Clientes: customers.length,
  });
  console.log("\nCredenciales demo (solo desarrollo):");
  for (const user of DEMO_USERS) {
    console.log(`  ${user.role.padEnd(13)} ${user.email.padEnd(20)} ${SEED_PASSWORD}`);
  }
  console.log("");
}

main()
  .catch((error) => {
    console.error("Error ejecutando el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
