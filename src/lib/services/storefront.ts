import {
  DeviceCondition,
  DeviceType,
  FinancingType,
  InventoryStatus,
  Prisma,
  type AccessoryCategory,
} from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/serialize";
import {
  STORE_PAGE_SIZE,
  type StoreAccessoryFilters,
  type StoreDeviceFilters,
} from "@/lib/validations/storefront";

/**
 * Consultas de la tienda pública.
 *
 * ── Seguridad ──────────────────────────────────────────────────────────────
 * Estas funciones NO exigen sesión: las ve cualquiera. Por eso:
 *   · Cada consulta selecciona campos de forma explícita (`select`). Nunca se
 *     devuelve una fila entera, así un campo interno nuevo no se filtra solo.
 *   · Jamás se exponen IMEI, número de serie, precio de compra, observaciones
 *     ni datos de quién cargó el equipo.
 *   · Solo existen equipos DISPONIBLES y accesorios activos con stock.
 */

export interface StoreDevice {
  id: string;
  brandName: string;
  modelName: string;
  type: DeviceType;
  color: string;
  storageGb: number | null;
  condition: DeviceCondition;
  batteryPercent: number | null;
  salePrice: number;
  /// Imágenes a mostrar, en orden: las fotos propias del equipo; si no tiene, la
  /// imagen de su modelo (salvo que se haya apagado); si no hay ninguna, la lista
  /// queda vacía y la tienda dibuja el equipo.
  imageUrls: string[];
}

export interface StoreDevicePage {
  items: StoreDevice[];
  total: number;
  page: number;
  pageCount: number;
}

const DEVICE_SELECT = {
  id: true,
  type: true,
  color: true,
  storageGb: true,
  condition: true,
  batteryPercent: true,
  salePrice: true,
  useModelImage: true,
  // Solo ids: los bytes de las imágenes se piden aparte, nunca en los listados.
  photos: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], take: 8, select: { id: true } },
  model: { select: { name: true, brand: { select: { name: true } }, image: { select: { id: true } } } },
} satisfies Prisma.DeviceSelect;

type DeviceRow = Prisma.DeviceGetPayload<{ select: typeof DEVICE_SELECT }>;

function toStoreDevice(row: DeviceRow): StoreDevice {
  return {
    id: row.id,
    brandName: row.model.brand.name,
    modelName: row.model.name,
    type: row.type,
    color: row.color,
    storageGb: row.storageGb,
    condition: row.condition,
    batteryPercent: row.batteryPercent,
    salePrice: toNumber(row.salePrice),
    imageUrls:
      row.photos.length > 0
        ? row.photos.map((photo) => `/api/fotos/${photo.id}`)
        : row.useModelImage && row.model.image
          ? [`/api/fotos/modelo/${row.model.image.id}`]
          : [],
  };
}

const AVAILABLE = { inventoryStatus: InventoryStatus.DISPONIBLE } as const;

function buildDeviceWhere(filters: Partial<StoreDeviceFilters>): Prisma.DeviceWhereInput {
  const and: Prisma.DeviceWhereInput[] = [];

  if (filters.search) {
    const term = filters.search;
    // Solo texto del catálogo: nunca se busca por IMEI ni número de serie.
    and.push({
      OR: [
        { color: { contains: term, mode: "insensitive" } },
        { model: { name: { contains: term, mode: "insensitive" } } },
        { model: { brand: { name: { contains: term, mode: "insensitive" } } } },
      ],
    });
  }

  if (filters.brandId) and.push({ model: { brandId: filters.brandId } });

  return {
    ...AVAILABLE,
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.condition ? { condition: filters.condition } : {}),
    ...(filters.storageGb ? { storageGb: filters.storageGb } : {}),
    ...(filters.maxPrice ? { salePrice: { lte: filters.maxPrice } } : {}),
    ...(and.length > 0 ? { AND: and } : {}),
  };
}

export async function listStoreDevices(filters: StoreDeviceFilters): Promise<StoreDevicePage> {
  const where = buildDeviceWhere(filters);

  const orderBy: Prisma.DeviceOrderByWithRelationInput[] =
    filters.sort === "price_asc"
      ? [{ salePrice: "asc" }, { id: "asc" }]
      : filters.sort === "price_desc"
        ? [{ salePrice: "desc" }, { id: "asc" }]
        : [{ entryDate: "desc" }, { id: "asc" }];

  const [total, rows] = await Promise.all([
    prisma.device.count({ where }),
    prisma.device.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * STORE_PAGE_SIZE,
      take: STORE_PAGE_SIZE,
      select: DEVICE_SELECT,
    }),
  ]);

  return {
    items: rows.map(toStoreDevice),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / STORE_PAGE_SIZE)),
  };
}

/// Últimos equipos ingresados, para la portada.
export async function listFeaturedDevices(limit = 8): Promise<StoreDevice[]> {
  const rows = await prisma.device.findMany({
    where: { ...AVAILABLE, type: DeviceType.CELULAR },
    orderBy: [{ entryDate: "desc" }, { id: "asc" }],
    take: limit,
    select: DEVICE_SELECT,
  });
  return rows.map(toStoreDevice);
}

export interface StoreDeviceDetail extends StoreDevice {
  modelId: string;
  /// Otras unidades disponibles del mismo modelo.
  related: StoreDevice[];
}

/// Un equipo disponible, o `null` si no existe o ya no está a la venta.
/// Memoizada por petición: la usan tanto los metadatos como la página.
export const getStoreDevice = cache(async function getStoreDevice(
  id: string,
): Promise<StoreDeviceDetail | null> {
  const row = await prisma.device.findFirst({
    where: { id, ...AVAILABLE },
    select: { ...DEVICE_SELECT, modelId: true },
  });

  if (!row) return null;

  const related = await prisma.device.findMany({
    where: { ...AVAILABLE, modelId: row.modelId, id: { not: row.id } },
    orderBy: [{ salePrice: "asc" }, { id: "asc" }],
    take: 6,
    select: DEVICE_SELECT,
  });

  return { ...toStoreDevice(row), modelId: row.modelId, related: related.map(toStoreDevice) };
});

export interface StoreFacets {
  brands: Array<{ id: string; name: string; count: number }>;
  storages: Array<{ gb: number; count: number }>;
  types: Array<{ type: DeviceType; count: number }>;
  conditions: Array<{ condition: DeviceCondition; count: number; minPrice: number }>;
  total: number;
}

/// Qué hay a la venta, para armar filtros y portada. Solo muestra opciones
/// con stock real: nunca se ofrece un filtro que devuelva cero resultados.
export async function getStoreFacets(): Promise<StoreFacets> {
  const [byModel, byStorage, byType, byCondition, models] = await Promise.all([
    prisma.device.groupBy({ by: ["modelId"], where: AVAILABLE, _count: { _all: true } }),
    prisma.device.groupBy({
      by: ["storageGb"],
      where: { ...AVAILABLE, storageGb: { not: null } },
      _count: { _all: true },
    }),
    prisma.device.groupBy({ by: ["type"], where: AVAILABLE, _count: { _all: true } }),
    prisma.device.groupBy({
      by: ["condition"],
      where: AVAILABLE,
      _count: { _all: true },
      _min: { salePrice: true },
    }),
    prisma.deviceModel.findMany({ select: { id: true, brand: { select: { id: true, name: true } } } }),
  ]);

  const brandOfModel = new Map(models.map((model) => [model.id, model.brand]));
  const brands = new Map<string, { id: string; name: string; count: number }>();

  for (const row of byModel) {
    const brand = brandOfModel.get(row.modelId);
    if (!brand) continue;
    const entry = brands.get(brand.id) ?? { id: brand.id, name: brand.name, count: 0 };
    entry.count += row._count._all;
    brands.set(brand.id, entry);
  }

  return {
    brands: [...brands.values()].sort((a, b) => a.name.localeCompare(b.name, "es")),
    storages: byStorage
      .filter((row): row is typeof row & { storageGb: number } => row.storageGb !== null)
      .map((row) => ({ gb: row.storageGb, count: row._count._all }))
      .sort((a, b) => a.gb - b.gb),
    types: byType.map((row) => ({ type: row.type, count: row._count._all })),
    conditions: byCondition.map((row) => ({
      condition: row.condition,
      count: row._count._all,
      minPrice: toNumber(row._min.salePrice),
    })),
    total: byType.reduce((sum, row) => sum + row._count._all, 0),
  };
}

// ---------------------------------------------------------------------------
// Accesorios
// ---------------------------------------------------------------------------

export interface StoreAccessory {
  id: string;
  name: string;
  brand: string | null;
  category: AccessoryCategory;
  salePrice: number;
  /// Se informa si quedan pocas unidades, nunca la cantidad exacta.
  lowStock: boolean;
}

export interface StoreAccessoryPage {
  items: StoreAccessory[];
  total: number;
  page: number;
  pageCount: number;
  categories: Array<{ category: AccessoryCategory; count: number }>;
}

const LOW_STOCK_THRESHOLD = 3;

export async function listStoreAccessories(
  filters: StoreAccessoryFilters,
): Promise<StoreAccessoryPage> {
  const base: Prisma.AccessoryWhereInput = { isActive: true, stockQuantity: { gt: 0 } };

  const where: Prisma.AccessoryWhereInput = {
    ...base,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { brand: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows, categories] = await Promise.all([
    prisma.accessory.count({ where }),
    prisma.accessory.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (filters.page - 1) * STORE_PAGE_SIZE,
      take: STORE_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        brand: true,
        category: true,
        salePrice: true,
        stockQuantity: true,
      },
    }),
    prisma.accessory.groupBy({ by: ["category"], where: base, _count: { _all: true } }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      brand: row.brand,
      category: row.category,
      salePrice: toNumber(row.salePrice),
      lowStock: row.stockQuantity <= LOW_STOCK_THRESHOLD,
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / STORE_PAGE_SIZE)),
    categories: categories.map((row) => ({ category: row.category, count: row._count._all })),
  };
}

// ---------------------------------------------------------------------------
// Financiación
// ---------------------------------------------------------------------------

export interface StorePlan {
  type: FinancingType;
  installments: number;
  surchargePercent: number;
}

/// Planes de cuotas activos, para mostrar cuánto sale cada cuota.
export async function listStorePlans(): Promise<StorePlan[]> {
  const rows = await prisma.financingPlan.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { installments: "asc" }],
    select: { type: true, installments: true, surchargePercent: true },
  });

  return rows.map((row) => ({
    type: row.type,
    installments: row.installments,
    surchargePercent: toNumber(row.surchargePercent),
  }));
}
