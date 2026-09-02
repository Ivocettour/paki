import type { Prisma } from "@prisma/client";

/**
 * Los `Decimal` de Prisma no son serializables hacia componentes de cliente.
 * Toda salida de la capa de servicios los convierte a `number` en el borde.
 *
 * Es seguro: `Decimal(12,2)` llega hasta 9.999.999.999,99, muy por debajo del
 * entero seguro de JavaScript.
 */
export function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

export function toNullableNumber(
  value: Prisma.Decimal | number | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : value.toNumber();
}
