/**
 * Reglas de WhatsApp Business que se respetan siempre:
 * texto libre solo dentro de las 24 horas siguientes al último mensaje de la
 * persona; fuera de esa ventana, solo plantillas aprobadas por Meta.
 */

export const WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinWindow(lastInboundAt: Date | null, now: Date = new Date()): boolean {
  return lastInboundAt !== null && now.getTime() - lastInboundAt.getTime() < WINDOW_MS;
}

/// Reemplaza {{1}}, {{2}}… por los parámetros, igual que hace WhatsApp con las plantillas.
export function renderTemplate(text: string, params: readonly string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_match, n: string) => params[Number(n) - 1] ?? "");
}

export type SendMode = { mode: "text" } | { mode: "template" } | { mode: "blocked"; reason: string };

/**
 * Cómo se le puede escribir a alguien ahora:
 *  - dentro de la ventana de 24 h: texto libre (el borrador);
 *  - fuera de la ventana: solo una plantilla aprobada por Meta. Si no hay una
 *    configurada, no se puede escribir.
 * `enforceWindow=false` permite texto libre siempre (solo pruebas simuladas).
 */
export function decideSendMode(input: {
  lastInboundAt: Date | null;
  now?: Date;
  enforceWindow: boolean;
  templateAvailable: boolean;
}): SendMode {
  if (!input.enforceWindow || isWithinWindow(input.lastInboundAt, input.now)) {
    return { mode: "text" };
  }
  if (input.templateAvailable) return { mode: "template" };
  return {
    mode: "blocked",
    reason:
      "Pasaron más de 24 horas desde su último mensaje y no hay una plantilla de WhatsApp aprobada configurada para volver a escribirle.",
  };
}

/// Traduce los errores de la WhatsApp Cloud API a mensajes que entienda quien
/// está en la bandeja.
export function describeWhatsAppError(code: number | null | undefined, fallback?: string | null): string {
  switch (code) {
    case 131047:
      return "Pasaron más de 24 horas desde su último mensaje: solo se puede enviar una plantilla aprobada.";
    case 131026:
      return "El mensaje no se pudo entregar: ese número puede no tener WhatsApp o no aceptó mensajes de empresas.";
    case 131030:
      return "Ese número no está en la lista de números de prueba de la cuenta de WhatsApp.";
    case 131051:
      return "WhatsApp no admite ese tipo de mensaje.";
    case 131056:
    case 130429:
      return "Se enviaron demasiados mensajes seguidos. Esperá unos minutos.";
    case 132000:
    case 132005:
    case 132012:
      return "Los datos de la plantilla no coinciden con la que aprobó Meta. Revisá el nombre, el idioma y las variables.";
    case 132001:
      return "La plantilla no existe o todavía no fue aprobada por Meta.";
    case 190:
      return "La clave de acceso de WhatsApp venció o es inválida. Hay que generar una nueva.";
    case 100:
      return "WhatsApp rechazó los datos del mensaje.";
    default:
      return fallback
        ? `WhatsApp no pudo enviar el mensaje (${fallback}).`
        : "WhatsApp no pudo enviar el mensaje.";
  }
}

/// +5493624123456 → formato de la API (solo dígitos), con la opción de quitar
/// el 9 de celular argentino.
export function toWhatsAppNumber(e164: string, dropArgentinaNine = false): string {
  const digits = e164.replace(/\D/g, "");
  return dropArgentinaNine && digits.startsWith("549") && digits.length === 13
    ? `54${digits.slice(3)}`
    : digits;
}
