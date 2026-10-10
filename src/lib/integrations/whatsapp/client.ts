import { randomUUID } from "node:crypto";
import { storeConfig } from "@/lib/store-config";
import { TEMPLATE_CATALOG, type CatalogEntry } from "./catalog";
import { describeWhatsAppError, toWhatsAppNumber } from "./rules";

/**
 * WhatsApp Business (Cloud API).
 *  - "mock": no se envía nada a nadie. El mensaje queda en la bandeja y en el
 *    log del servidor. Es el modo por defecto.
 *  - "live": API real de Meta. Sigue la documentación oficial, pero no se pudo
 *    probar sin credenciales reales.
 */
export function whatsappMode(): "mock" | "live" {
  return process.env.WHATSAPP_MODE === "live" ? "live" : "mock";
}

/// Si se controla la ventana de 24 h. Solo se puede apagar con canales simulados.
export function enforceWindow(): boolean {
  return whatsappMode() === "live" || process.env.WHATSAPP_ENFORCE_WINDOW !== "false";
}

export const graphVersion = () => process.env.META_GRAPH_VERSION || "v21.0";
export const metaAppSecret = () => process.env.META_APP_SECRET ?? "";
export const whatsappVerifyToken = () => process.env.WHATSAPP_VERIFY_TOKEN ?? "";

export interface NamedTemplate {
  name: string;
  language: string;
  text: string;
}

/// Plantilla aprobada por Meta para cada clave del catálogo. El texto tiene que
/// ser idéntico al aprobado. En modo simulado existe una de ejemplo; en modo
/// real, si no está configurada, devuelve null.
export function whatsappTemplate(entry: CatalogEntry): NamedTemplate | null {
  const name = process.env[`WHATSAPP_TEMPLATE_${entry.key}_NAME`];
  const text = process.env[`WHATSAPP_TEMPLATE_${entry.key}_TEXT`];

  if (name && text) {
    return { name, language: process.env[`WHATSAPP_TEMPLATE_${entry.key}_LANGUAGE`] || "es_AR", text };
  }
  return whatsappMode() === "mock"
    ? { name: entry.mockName, language: "es_AR", text: entry.mockText(storeConfig.name) }
    : null;
}

export interface AvailableTemplate {
  entry: CatalogEntry;
  template: NamedTemplate;
}

/// Las plantillas que se pueden usar ahora: en modo simulado todas; en modo
/// real, las que están configuradas.
export function availableTemplates(): AvailableTemplate[] {
  return TEMPLATE_CATALOG.flatMap((entry) => {
    const template = whatsappTemplate(entry);
    return template ? [{ entry, template }] : [];
  });
}

export class WhatsAppSendError extends Error {}

async function postMessage(payload: Record<string, unknown>): Promise<{ externalId: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    throw new WhatsAppSendError("Faltan WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_ACCESS_TOKEN.");
  }

  const res = await fetch(`https://graph.facebook.com/${graphVersion()}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    signal: AbortSignal.timeout(20_000),
  });

  const data = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { code?: number; message?: string };
  };

  if (!res.ok || !data.messages?.[0]?.id) {
    throw new WhatsAppSendError(
      describeWhatsAppError(data.error?.code, data.error?.message ?? `HTTP ${res.status}`),
    );
  }
  return { externalId: data.messages[0].id };
}

const dropNine = () => process.env.WHATSAPP_ARGENTINA_DROP_NINE === "true";

export async function sendWhatsAppText(to: string, body: string): Promise<{ externalId: string }> {
  if (whatsappMode() === "mock") {
    console.info(`[WhatsApp simulado] → ${to}: ${body.slice(0, 80).replace(/\s+/g, " ")}…`);
    return { externalId: `mock-${randomUUID()}` };
  }
  return postMessage({
    to: toWhatsAppNumber(to, dropNine()),
    type: "text",
    text: { preview_url: false, body },
  });
}

export async function sendWhatsAppTemplate(
  to: string,
  template: NamedTemplate,
  params: readonly string[],
): Promise<{ externalId: string }> {
  if (whatsappMode() === "mock") {
    console.info(`[WhatsApp simulado] → ${to}: plantilla ${template.name} (${params.join(", ")})`);
    return { externalId: `mock-${randomUUID()}` };
  }
  return postMessage({
    to: toWhatsAppNumber(to, dropNine()),
    type: "template",
    template: {
      name: template.name,
      language: { code: template.language },
      components: [
        { type: "body", parameters: params.map((text) => ({ type: "text", text })) },
      ],
    },
  });
}
