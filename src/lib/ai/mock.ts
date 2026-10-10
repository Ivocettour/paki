import { firstName } from "@/lib/domain/phone";
import { normalizeMessage } from "@/lib/domain/messages";
import { formatCurrency } from "@/lib/utils";
import { mockPriority } from "./priority-rules";
import type { Classification, DraftInput, DraftResult, RewriteStyle } from "./types";

/**
 * Versión simulada de la IA: reglas simples y plantillas. Permite probar la
 * bandeja de punta a punta sin credenciales. No pretende escribir bien: el
 * borrador real lo hace el modelo.
 */

export function mockClassify(input: DraftInput): Classification {
  const lastInbound = [...input.history].reverse().find((m) => m.direction === "IN");
  const last = input.history.at(-1);

  return {
    interestNote: input.lead.interestNote,
    priority: mockPriority({
      lastMessage: lastInbound?.body ?? null,
      stage: input.lead.stage,
      waitingHours:
        last?.direction === "IN" && lastInbound
          ? Math.max(0, (Date.now() - lastInbound.at.getTime()) / 3_600_000)
          : null,
    }),
  };
}

export function mockDraft(input: DraftInput): string {
  const name = firstName(input.lead.fullName);
  const signer = firstName(input.signerName);
  const alreadyWrote = input.history.some((m) => m.direction === "OUT");
  const intro = alreadyWrote
    ? `Hola ${name}, ¿cómo estás?`
    : `Hola ${name}, soy ${signer} de ${input.store.name}. Gracias por escribirnos.`;

  const device = input.lead.device;
  const lastInbound = [...input.history].reverse().find((m) => m.direction === "IN");
  const text = normalizeMessage(lastInbound?.body ?? "");
  const asksFinancing = /\b(cuotas?|financi\w*|tarjeta)\b/.test(text);

  if (device && !device.available) {
    const alternatives = input.catalog.slice(0, 2);
    const suggestion =
      alternatives.length > 0
        ? `Tenemos ${alternatives.map((a) => `${a.title}${a.storage ? ` ${a.storage}` : ""} (${formatCurrency(a.price)})`).join(" y ")}.`
        : "Si querés, te avisamos cuando ingrese uno parecido.";
    return `${intro}\n\nEl ${device.title} que consultaste ya no está disponible. ${suggestion}\n\n¿Querés que te cuente más de alguno?`;
  }

  if (device) {
    const specs = [device.storage, device.color, device.condition.toLowerCase()].filter(Boolean).join(", ");
    const battery = device.batteryPercent !== null ? ` con ${device.batteryPercent}% de batería` : "";
    const financing = asksFinancing && input.store.plans.length > 0
      ? " Trabajamos con cuotas, te paso cómo queda cada una si querés."
      : "";
    return `${intro}\n\nEl ${device.title} (${specs})${battery} está a ${formatCurrency(device.price)}.${financing}\n\n¿Querés pasar a verlo o lo reservamos?`;
  }

  return `${intro}\n\n¿Qué equipo estás buscando? Contame modelo, capacidad y presupuesto, y te paso lo que tenemos disponible.`;
}

export function mockClassifyAndDraft(input: DraftInput): DraftResult {
  return {
    classification: mockClassify(input),
    draft: mockDraft(input),
    generatedBy: "mock",
  };
}

export function mockRewrite(text: string, style: RewriteStyle): string {
  if (style === "formal") {
    return text.replace(/\bvos\b/gi, "usted").replace(/\bquerés\b/gi, "desea").replace(/\btenés\b/gi, "tiene");
  }
  // Más breve: se queda con el primer y el último párrafo.
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);
  return paragraphs.length > 2 ? [paragraphs[0], paragraphs.at(-1)].join("\n\n") : text;
}
