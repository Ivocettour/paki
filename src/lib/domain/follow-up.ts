import type { LeadStage } from "@prisma/client";
import { businessDay, calendarDayToDate } from "@/lib/domain/installments";
import { CLOSED_LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/constants";
import { formatBusinessDate } from "@/lib/utils";

/**
 * Reglas puras del seguimiento: cuándo vence un contacto y cómo se arma el
 * aviso diario. Sin base de datos ni sesión.
 *
 * Los vencimientos se comparan por DÍA DE CALENDARIO en la zona del local: un
 * contacto a las 9:00 de hoy es "hoy" aunque ya sean las 15:00, no "vencido".
 */

const MS_PER_DAY = 86_400_000;

export type DueStatus = "overdue" | "today" | "upcoming" | "none";

export interface DueInfo {
  status: DueStatus;
  /// Negativo si está vencido, 0 si es hoy.
  days: number | null;
  label: string;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((calendarDayToDate(businessDay(to)).getTime() - calendarDayToDate(businessDay(from)).getTime()) / MS_PER_DAY);
}

export function dueInfo(next: Date | null, now: Date = new Date()): DueInfo {
  if (!next) return { status: "none", days: null, label: "Sin fecha" };

  const days = daysBetween(now, next);
  if (days < 0) {
    return {
      status: "overdue",
      days,
      label: days === -1 ? "Vencido desde ayer" : `Vencido hace ${-days} días`,
    };
  }
  if (days === 0) return { status: "today", days, label: "Hoy" };
  if (days === 1) return { status: "upcoming", days, label: "Mañana" };
  if (days < 7) return { status: "upcoming", days, label: `En ${days} días` };
  return { status: "upcoming", days, label: formatBusinessDate(calendarDayToDate(businessDay(next))) };
}

export function isClosed(stage: LeadStage): boolean {
  return CLOSED_LEAD_STAGES.includes(stage);
}

/// Instante a las `hour` (hora del local, UTC-3) de dentro de `dayOffset` días.
export function atBusinessHour(dayOffset: number, hour = 10, now: Date = new Date()): Date {
  const today = calendarDayToDate(businessDay(now));
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + dayOffset, hour + 3),
  );
}

export interface DigestLead {
  id: string;
  fullName: string;
  stage: LeadStage;
  nextContactAt: Date | null;
  nextContactNote: string | null;
  pauseReason: string | null;
  deviceName: string | null;
}

export interface Digest {
  subject: string;
  body: string;
  overdue: number;
  today: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Arma el aviso diario de una persona: primero lo vencido (lo más urgente),
 * después lo de hoy. Devuelve null si no hay nada que avisar: no se manda un
 * aviso vacío.
 */
export function buildDigest(
  userName: string,
  leads: readonly DigestLead[],
  appUrl: string,
  now: Date = new Date(),
): Digest | null {
  const overdue: DigestLead[] = [];
  const today: DigestLead[] = [];

  for (const lead of leads) {
    const info = dueInfo(lead.nextContactAt, now);
    if (info.status === "overdue") overdue.push(lead);
    else if (info.status === "today") today.push(lead);
  }

  if (overdue.length === 0 && today.length === 0) return null;

  // Lo más atrasado primero.
  overdue.sort((a, b) => (a.nextContactAt?.getTime() ?? 0) - (b.nextContactAt?.getTime() ?? 0));

  const line = (lead: DigestLead) => {
    const info = dueInfo(lead.nextContactAt, now);
    const why = lead.nextContactNote || lead.pauseReason;
    const detail = [LEAD_STAGE_LABELS[lead.stage], lead.deviceName, why].filter(Boolean).join(" · ");
    const when = info.status === "overdue" ? ` (${info.label.toLowerCase()})` : "";
    return `- ${lead.fullName}${when}: ${detail}\n  ${appUrl}/consultas/${lead.id}`;
  };

  const parts = [`Hola ${userName.split(" ")[0]}, este es tu día en el seguimiento de clientes.`];
  if (overdue.length) parts.push(`VENCIDOS (${overdue.length})\n${overdue.map(line).join("\n")}`);
  if (today.length) parts.push(`PARA HOY (${today.length})\n${today.map(line).join("\n")}`);
  parts.push(`Tablero completo: ${appUrl}/seguimiento`);

  const subject =
    "Tu día en el seguimiento: " +
    [
      today.length ? plural(today.length, "contacto para hoy", "contactos para hoy") : null,
      overdue.length ? plural(overdue.length, "vencido", "vencidos") : null,
    ]
      .filter(Boolean)
      .join(" y ");

  return { subject, body: parts.join("\n\n"), overdue: overdue.length, today: today.length };
}
