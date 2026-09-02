import { z } from "zod";
import { AuditAction } from "@prisma/client";

/// Entidades sobre las que se registra auditoría.
export const AUDIT_ENTITIES = [
  "Device",
  "Accessory",
  "Sale",
  "Installment",
  "Purchase",
  "Supplier",
  "Customer",
  "User",
  "Brand",
  "DeviceModel",
] as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[number];

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  Device: "Equipo",
  Accessory: "Accesorio",
  Sale: "Venta",
  Installment: "Cuota",
  Purchase: "Compra",
  Supplier: "Proveedor",
  Customer: "Cliente",
  User: "Usuario",
  Brand: "Marca",
  DeviceModel: "Modelo",
};

/// A dónde lleva cada entidad cuando se puede abrir su ficha.
export const AUDIT_ENTITY_PATHS: Partial<Record<AuditEntity, string>> = {
  Device: "/inventario",
  Sale: "/ventas",
  Purchase: "/compras",
  Customer: "/clientes",
};

export const auditFiltersSchema = z.object({
  search: z.string().trim().optional(),
  userId: z.string().optional(),
  action: z.enum(AuditAction).optional(),
  entity: z.enum(AUDIT_ENTITIES).optional(),
  entityId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
});

export type AuditFilters = z.output<typeof auditFiltersSchema>;
