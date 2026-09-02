import { InstallmentStatus } from "@prisma/client";
import type { InstallmentDisplayStatus } from "@/lib/constants";
import { errors } from "@/lib/errors";

/**
 * Reglas puras del plan de cuotas.
 *
 * Este módulo no depende de la base de datos ni de la sesión: es lógica de
 * negocio verificable de forma aislada.
 *
 * ── Cómo se representan los vencimientos ──────────────────────────────────
 * El vencimiento de una cuota es un DÍA DEL CALENDARIO, no un instante.
 * Se almacena como medianoche UTC de ese día (2026-06-15T00:00:00Z ≡ "15/06").
 *
 * Sin esa convención el dato se corre: el servidor de producción (Vercel) corre
 * en UTC y el local está en UTC-3, así que interpretar el timestamp con la hora
 * local del proceso mostraría el día anterior y marcaría cuotas vencidas antes
 * de tiempo.
 *
 * Consecuencia: las fechas de vencimiento SIEMPRE se formatean con `timeZone:
 * "UTC"` (ver `formatBusinessDate` en `@/lib/utils`).
 */

/// Zona horaria del local, usada para saber qué día es "hoy".
export const BUSINESS_TIME_ZONE = "America/Argentina/Buenos_Aires";

const businessDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/// Día calendario en la zona del local, como "YYYY-MM-DD".
export function businessDay(date: Date): string {
  return businessDayFormatter.format(date);
}

/// Convierte un día calendario a su instante canónico (medianoche UTC).
export function calendarDayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/**
 * Instante canónico del día de hoy según la zona del local.
 * Es el límite que usan las consultas de vencimiento.
 */
export function startOfBusinessToday(now: Date = new Date()): Date {
  return calendarDayToDate(businessDay(now));
}

/**
 * Deriva el estado visible de una cuota.
 *
 * "Vencida" no se persiste nunca: se calcula contra la fecha actual, de modo
 * que no puede quedar desactualizado ni requiere una tarea programada.
 * Una cuota que vence hoy todavía NO está vencida.
 */
export function resolveDisplayStatus(
  status: InstallmentStatus,
  dueDate: Date,
  now: Date = new Date(),
): { displayStatus: InstallmentDisplayStatus; daysOverdue: number } {
  if (status !== InstallmentStatus.PENDIENTE) {
    return { displayStatus: status, daysOverdue: 0 };
  }

  // El vencimiento se normaliza a su día calendario UTC: así el cálculo es
  // correcto incluso si el dato guardado no cayera exactamente en medianoche.
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const today = startOfBusinessToday(now).getTime();
  const overdue = Math.round((today - due) / 86_400_000);

  return overdue > 0
    ? { displayStatus: "VENCIDA", daysOverdue: overdue }
    : { displayStatus: InstallmentStatus.PENDIENTE, daysOverdue: 0 };
}

/**
 * Reparte un total en cuotas mensuales.
 *
 * El cálculo se hace en centavos y el resto del redondeo se acumula en la
 * primera cuota, para que la suma coincida exactamente con el total: nunca se
 * pierde ni se inventa un peso.
 *
 * Cuando el día de vencimiento no existe en el mes destino (por ejemplo, el 31
 * en un mes de 30 días), se ancla al último día de ese mes en lugar de
 * desbordar al siguiente.
 */
export function buildInstallmentPlan(
  total: number,
  count: number,
  firstDueDate: Date,
): Array<{ number: number; dueDate: Date; amount: number }> {
  if (!Number.isInteger(count) || count < 1) {
    throw errors.validacion("La cantidad de cuotas debe ser al menos 1.");
  }

  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;

  // El día de referencia se toma en la zona del local.
  const [year, month, day] = businessDay(firstDueDate).split("-").map(Number);

  return Array.from({ length: count }, (_, index) => {
    const targetMonth = month - 1 + index;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;

    // Día 0 del mes siguiente = último día del mes objetivo.
    const lastDayOfMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const dueDate = new Date(
      Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDayOfMonth)),
    );

    const cents = index === 0 ? baseCents + remainderCents : baseCents;
    return { number: index + 1, dueDate, amount: cents / 100 };
  });
}
