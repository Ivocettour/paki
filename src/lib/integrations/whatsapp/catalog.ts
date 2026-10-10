import { businessDay, calendarDayToDate } from "@/lib/domain/installments";

/**
 * Catálogo de plantillas de WhatsApp para volver a escribirle a alguien pasadas
 * las 24 horas.
 *
 * Meta solo permite plantillas aprobadas: el texto es fijo y lo único que se
 * completa son las variables ({{1}}, {{2}}…). Por eso cada plantilla define qué
 * variable es qué: algunas se completan solas (nombre de la persona, quien
 * escribe) y otras las completa el vendedor antes de enviar (tema, día, hora).
 */

export type FieldId = "nombre" | "remitente" | "tema" | "fecha" | "hora";
export type FieldKind = "contact-name" | "sender-name" | "text" | "date" | "time";

export interface FieldDef {
  index: number;
  id: FieldId;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  max?: number;
}

export type CatalogKey = "PRIMERO" | "REENGAGE" | "RETOMAR" | "INFO" | "CITA";

export interface CatalogEntry {
  key: CatalogKey;
  label: string;
  hint: string;
  /// Nombre y texto de ejemplo para el modo simulado. En modo real se usan los
  /// aprobados por Meta (variables de entorno).
  mockName: string;
  mockText: (store: string) => string;
  fields: FieldDef[];
}

const NOMBRE: FieldDef = { index: 1, id: "nombre", label: "Nombre", kind: "contact-name" };
const REMITENTE: FieldDef = { index: 2, id: "remitente", label: "Quién escribe", kind: "sender-name" };
const TEMA: FieldDef = {
  index: 3,
  id: "tema",
  label: "Tema de la consulta",
  kind: "text",
  placeholder: "el iPhone 15 Pro de 256 GB",
  max: 90,
};

export const TEMPLATE_CATALOG: readonly CatalogEntry[] = [
  {
    key: "PRIMERO",
    label: "Responder a una consulta de la tienda",
    hint: "Primer mensaje a alguien que dejó sus datos en la tienda y todavía no escribió por WhatsApp.",
    mockName: "responder_consulta",
    mockText: (store) =>
      `Hola {{1}}, soy {{2}} de ${store}. Recibimos tu consulta sobre {{3}} y queremos ayudarte. ¿Te parece que sigamos la conversación por acá?`,
    fields: [NOMBRE, REMITENTE, TEMA],
  },
  {
    key: "REENGAGE",
    label: "Retomar la conversación (general)",
    hint: "Un saludo corto para reabrir la charla, sin mencionar un tema.",
    mockName: "recontacto_consulta",
    mockText: (store) =>
      `Hola {{1}}, te escribe {{2}} de ${store} por tu consulta. ¿Seguimos la conversación por acá?`,
    fields: [NOMBRE, REMITENTE],
  },
  {
    key: "RETOMAR",
    label: "Retomar una consulta",
    hint: "Para quien consultó hace unos días y no siguió.",
    mockName: "retomar_consulta",
    mockText: (store) =>
      `Hola {{1}}, te escribe {{2}} de ${store}. Hace unos días consultaste por {{3}} y queremos saber si seguís interesado o si preferís que te ayudemos con otro equipo. Podés responder por acá.`,
    fields: [NOMBRE, REMITENTE, TEMA],
  },
  {
    key: "INFO",
    label: "Tenemos lo que buscabas",
    hint: "Cuando ingresó un equipo que la persona estaba buscando.",
    mockName: "equipo_disponible",
    mockText: (store) =>
      `Hola {{1}}, soy {{2}} de ${store}. Tenemos disponible {{3}}, que nos habías consultado. ¿Querés que te pasemos los detalles por acá?`,
    fields: [NOMBRE, REMITENTE, TEMA],
  },
  {
    key: "CITA",
    label: "Confirmar una visita al local",
    hint: "Confirma una visita ya acordada, con día y hora.",
    mockName: "confirmar_visita",
    mockText: (store) =>
      `Hola {{1}}, te confirmamos tu visita a ${store} el {{2}} a las {{3}}. Si necesitás cambiarla, respondé este mensaje y la coordinamos.`,
    fields: [
      NOMBRE,
      { index: 2, id: "fecha", label: "Día", kind: "date" },
      { index: 3, id: "hora", label: "Hora", kind: "time" },
    ],
  },
];

/// Meta no admite saltos de línea ni tabulaciones en una variable, ni espacios repetidos.
export function cleanVariable(text: string): string {
  return text.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/// "2026-10-14" → "martes 14/10". Null si la fecha no es válida o ya pasó.
export function formatAppointmentDay(iso: string, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  if (date.getTime() < calendarDayToDate(businessDay(now)).getTime()) return null;

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${WEEKDAYS[date.getUTCDay()]} ${day}/${month}`;
}

export interface BuildContext {
  contactFirstName: string;
  senderFirstName: string;
  values: Readonly<Record<string, string>>;
  now?: Date;
}

export type BuildResult = { ok: true; params: string[] } | { ok: false; error: string };

/// Arma las variables de una plantilla en el orden que pide Meta y valida lo
/// que completó la persona.
export function buildTemplateParams(entry: CatalogEntry, ctx: BuildContext): BuildResult {
  const params: string[] = [];

  for (const field of [...entry.fields].sort((a, b) => a.index - b.index)) {
    if (field.kind === "contact-name") {
      params.push(cleanVariable(ctx.contactFirstName) || "hola");
      continue;
    }
    if (field.kind === "sender-name") {
      params.push(cleanVariable(ctx.senderFirstName));
      continue;
    }

    const raw = cleanVariable(ctx.values[field.id] ?? "");
    if (!raw) return { ok: false, error: `Completá “${field.label}”.` };

    if (field.kind === "date") {
      const day = formatAppointmentDay(raw, ctx.now);
      if (!day) return { ok: false, error: "La fecha de la visita no es válida o ya pasó." };
      params.push(day);
    } else if (field.kind === "time") {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
        return { ok: false, error: "La hora no es válida (por ejemplo, 16:30)." };
      }
      params.push(raw);
    } else {
      const max = field.max ?? 90;
      if (raw.length > max) {
        return { ok: false, error: `“${field.label}” es demasiado largo (máximo ${max} caracteres).` };
      }
      params.push(raw);
    }
  }

  return { ok: true, params };
}
