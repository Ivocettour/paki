import { prisma } from "@/lib/db";
import { storeConfig } from "@/lib/store-config";
import { NOTIFY_TEMPLATE, cleanVariable } from "@/lib/integrations/whatsapp/catalog";
import {
  sendWhatsAppTemplate,
  sendWhatsAppText,
  whatsappTemplate,
} from "@/lib/integrations/whatsapp/client";
import { renderTemplate } from "@/lib/integrations/whatsapp/rules";
import { DEVICE_CONDITION_LABELS } from "@/lib/constants";
import { logWebhook } from "./channels";

/**
 * Números a los que se avisa de cada consulta nueva de la tienda, separados por
 * coma. Si no se define `STORE_NOTIFY_WHATSAPP`, se usa el WhatsApp del local.
 */
export function notifyRecipients(): string[] {
  const raw = process.env.STORE_NOTIFY_WHATSAPP || storeConfig.whatsapp;
  return raw
    .split(",")
    .map((n) => n.replace(/\D/g, ""))
    .filter((n) => n.length >= 8);
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/**
 * Le avisa por WhatsApp al dueño que entró una consulta por la tienda, para que
 * le llegue al celular además de al panel.
 *
 * Nunca lanza: un aviso que falla no puede romper la consulta del cliente. El
 * resultado queda en el registro de Canales para poder diagnosticarlo.
 *
 * WhatsApp solo permite escribirle a alguien por iniciativa propia con una
 * plantilla aprobada; por eso se usa la de aviso si está configurada y, si no,
 * se intenta texto libre (que solo llega si el dueño escribió en las últimas 24 h).
 */
export async function notifyOwnerOfInquiry(leadId: string): Promise<void> {
  try {
    const recipients = notifyRecipients();
    if (recipients.length === 0) return;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        fullName: true,
        phone: true,
        email: true,
        device: {
          select: {
            color: true,
            condition: true,
            model: { select: { name: true, brand: { select: { name: true } } } },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
      },
    });
    if (!lead) return;

    const device = lead.device
      ? `${lead.device.model.brand.name} ${lead.device.model.name} (${DEVICE_CONDITION_LABELS[lead.device.condition].toLowerCase()})`
      : "ningún equipo en particular";
    // El mensaje trae un prefijo "[Consulta por …]" que ya va en el equipo.
    const message = (lead.messages[0]?.body ?? "").replace(/^\[Consulta por [^\]]*\]\s*/, "");

    const params = [
      storeConfig.name,
      clip(cleanVariable(lead.fullName), 40),
      cleanVariable(lead.phone ?? lead.email ?? "sin datos"),
      clip(cleanVariable(device), 60),
      clip(cleanVariable(message), 140),
    ];

    const template = whatsappTemplate(NOTIFY_TEMPLATE);

    for (const to of recipients) {
      try {
        if (template) {
          await sendWhatsAppTemplate(`+${to}`, template, params);
        } else {
          await sendWhatsAppText(
            `+${to}`,
            renderTemplate(NOTIFY_TEMPLATE.mockText(storeConfig.name), params),
          );
        }
        await logWebhook({ source: "aviso", signatureOk: true, kind: "consulta-nueva", outcome: "ok", detail: `Aviso enviado a +${to}` });
      } catch (error) {
        await logWebhook({
          source: "aviso",
          signatureOk: true,
          kind: "consulta-nueva",
          outcome: "error",
          detail: `No se pudo avisar a +${to}: ${(error as Error).message}`,
        });
      }
    }
  } catch (error) {
    console.error("[aviso] No se pudo avisar de la consulta nueva:", error);
  }
}
