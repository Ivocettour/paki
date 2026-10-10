import type { LeadPriority, LeadStage } from "@prisma/client";
import { normalizeMessage } from "@/lib/domain/messages";

/**
 * Reglas simples para sugerir la prioridad de una consulta. Son el plan B
 * cuando la IA no está disponible (sin clave, sin conexión o respuesta inválida)
 * y lo que usa el modo simulado. Dan un orden razonable y explican por qué.
 */

export interface PriorityInput {
  lastMessage: string | null;
  stage: LeadStage;
  /// Horas que lleva esperando respuesta (null si el último mensaje es nuestro).
  waitingHours: number | null;
}

const HIGH =
  /\b(reservar|reserva|sena|comprar|compro|llevo|llevarlo|retirar|retiro|visita|pasar por|paso por|hoy|manana|urgente|cuanto antes|contado|transferencia|financi\w*|cuotas?|queja|reclamo|nadie me respondio|sigue disponible|esta disponible)\b/;
const LOW =
  /\b(mas adelante|sin apuro|solo (estoy )?(mirando|curiosidad)|despues veo|no estoy seguro|solo consulto)\b/;

export function mockPriority(input: PriorityInput): { level: LeadPriority; reason: string } {
  const text = normalizeMessage(input.lastMessage ?? "");
  const late = input.waitingHours !== null && input.waitingHours >= 48;

  if (HIGH.test(text)) return { level: "ALTA", reason: "Pide avanzar: reserva, visita o compra" };
  if (input.stage === "RESERVADO" || input.stage === "PRECIO_ENVIADO") {
    return { level: "ALTA", reason: "Está en una etapa avanzada de la venta" };
  }
  if (late) return { level: "ALTA", reason: "Espera respuesta hace más de 2 días" };
  if (LOW.test(text) || input.stage === "EN_PAUSA" || input.stage === "PERDIDO") {
    return { level: "BAJA", reason: "Consulta sin apuro o en pausa" };
  }
  return { level: "MEDIA", reason: "Consulta de información" };
}
