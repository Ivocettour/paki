import { z } from "zod";
import { AccessoryCategory, DeviceCondition, DeviceType } from "@prisma/client";

/// Cantidad de productos por página en la tienda.
export const STORE_PAGE_SIZE = 12;

export const STORE_SORT_OPTIONS = ["recent", "price_asc", "price_desc"] as const;
export type StoreSort = (typeof STORE_SORT_OPTIONS)[number];

export const STORE_SORT_LABELS: Record<StoreSort, string> = {
  recent: "Más recientes",
  price_asc: "Menor precio",
  price_desc: "Mayor precio",
};

/// Filtros públicos. Todo viene de la URL, así que cada valor se valida y los
/// inválidos se descartan en lugar de romper la página.
export const storeDeviceFiltersSchema = z.object({
  search: z.string().trim().max(80).optional(),
  type: z.enum(DeviceType).optional(),
  brandId: z.string().max(40).optional(),
  condition: z.enum(DeviceCondition).optional(),
  storageGb: z.coerce.number().int().positive().optional(),
  maxPrice: z.coerce.number().positive().max(999_999_999).optional(),
  sort: z.enum(STORE_SORT_OPTIONS).default("recent"),
  page: z.coerce.number().int().positive().max(500).default(1),
});

export const storeAccessoryFiltersSchema = z.object({
  search: z.string().trim().max(80).optional(),
  category: z.enum(AccessoryCategory).optional(),
  page: z.coerce.number().int().positive().max(500).default(1),
});

export type StoreDeviceFilters = z.output<typeof storeDeviceFiltersSchema>;
export type StoreAccessoryFilters = z.output<typeof storeAccessoryFiltersSchema>;

/// Interpreta los parámetros de la URL descartando los que no valen.
/// Si un parámetro es inválido se ignora ese solo, no todos.
export function parseStoreParams<T extends z.ZodObject>(
  schema: T,
  params: Record<string, string | string[] | undefined>,
): z.output<T> {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }

  const parsed = schema.safeParse(flat);
  if (parsed.success) return parsed.data;

  // Se descartan solo las claves con error y se vuelve a intentar.
  const invalid = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
  const cleaned = Object.fromEntries(Object.entries(flat).filter(([key]) => !invalid.has(key)));
  return schema.parse(cleaned);
}
