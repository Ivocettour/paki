import { LeadStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { DEFAULT_SIMILARITY_THRESHOLD, findDuplicate, normalizeMessage } from "@/lib/domain/messages";
import { firstName } from "@/lib/domain/phone";
import { atBusinessHour } from "@/lib/domain/follow-up";
import { buildTemplateParams } from "@/lib/integrations/whatsapp/catalog";
import {
  availableTemplates,
  enforceWindow,
  sendWhatsAppTemplate,
  sendWhatsAppText,
} from "@/lib/integrations/whatsapp/client";
import { decideSendMode, renderTemplate } from "@/lib/integrations/whatsapp/rules";
import { recordAudit } from "../audit";
import { assertLeadAccess } from "./access";
import { moveStage } from "./stage";

export type SendResult =
  | { status: "sent"; messageId: string; viaTemplate: boolean }
  | { status: "blocked"; kind: "exact" | "similar"; previousBody: string; previousAt: Date }
  | { status: "error"; error: string };

export interface SendInput {
  leadId: string;
  body: string;
  draftId?: string | null;
  /// Si es la primera respuesta con precio, pasa la etapa a "Precio enviado".
  markPriceSent?: boolean;
  /// En cuántos días hay que volver a escribirle si no responde.
  nextContactDays?: number;
  /// Plantilla elegida y los valores de sus variables, para cuando pasaron más
  /// de 24 h. Sin esto se usa la general.
  template?: { key: string; values: Record<string, string> };
}

/**
 * Único camino para enviarle algo a un cliente: lo dispara una persona, con su
 * nombre. Bloquea el mensaje si es igual o casi igual a algo que ya se le mandó.
 */
export async function sendReply(input: SendInput): Promise<SendResult> {
  const user = await requirePermission("consultas.responder");
  await assertLeadAccess(user, input.leadId);

  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { id: true, fullName: true, phone: true, stage: true },
  });
  if (!lead) throw errors.noEncontrado("la consulta");

  if (!lead.phone) {
    return {
      status: "error",
      error:
        "Esta persona no dejó teléfono, así que no se le puede escribir por WhatsApp. Respondele por correo.",
    };
  }

  // WhatsApp solo permite texto libre dentro de las 24 h desde el último
  // mensaje de la persona POR WHATSAPP. Fuera de esa ventana (o si todavía no
  // escribió por ahí, como quien consultó desde la tienda) solo sale una
  // plantilla aprobada por Meta.
  const lastWhatsapp = await prisma.leadMessage.findFirst({
    where: { leadId: lead.id, direction: "ENTRANTE", channel: "WHATSAPP" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const templates = availableTemplates();
  const plan = decideSendMode({
    lastInboundAt: lastWhatsapp?.createdAt ?? null,
    enforceWindow: enforceWindow(),
    templateAvailable: templates.length > 0,
  });
  if (plan.mode === "blocked") return { status: "error", error: plan.reason };

  // Pasadas las 24 h solo sale la plantilla elegida, con sus variables completas.
  let chosen: (typeof templates)[number] | undefined;
  let templateParams: string[] = [];

  if (plan.mode === "template") {
    const generic = templates.find((t) =>
      t.entry.fields.every((f) => f.kind === "contact-name" || f.kind === "sender-name"),
    );
    chosen = input.template ? templates.find((t) => t.entry.key === input.template!.key) : generic;
    if (!chosen) {
      return {
        status: "error",
        error: input.template ? "Esa plantilla no está disponible." : "Elegí una plantilla para escribirle.",
      };
    }

    const built = buildTemplateParams(chosen.entry, {
      contactFirstName: firstName(lead.fullName),
      senderFirstName: firstName(user.fullName),
      values: input.template?.values ?? {},
    });
    if (!built.ok) return { status: "error", error: built.error };
    templateParams = built.params;
  }

  const viaTemplate = chosen !== undefined;
  const body = chosen ? renderTemplate(chosen.template.text, templateParams) : input.body.trim();

  if (body.length === 0) return { status: "error", error: "El mensaje está vacío." };
  if (body.length > 4000) {
    return { status: "error", error: "El mensaje es demasiado largo (máximo 4000 caracteres)." };
  }

  const previous = await prisma.leadMessage.findMany({
    where: { leadId: lead.id, direction: "SALIENTE", status: { not: "FALLIDO" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, body: true, normalizedText: true, createdAt: true },
  });

  const duplicate = findDuplicate(body, previous, DEFAULT_SIMILARITY_THRESHOLD);
  if (duplicate) {
    return {
      status: "blocked",
      kind: duplicate.kind,
      previousBody: duplicate.previous.body,
      previousAt: duplicate.previous.createdAt,
    };
  }

  let externalId: string;
  try {
    externalId = (
      chosen
        ? await sendWhatsAppTemplate(lead.phone, chosen.template, templateParams)
        : await sendWhatsAppText(lead.phone, body)
    ).externalId;
  } catch (error) {
    return { status: "error", error: `No se pudo enviar: ${(error as Error).message}` };
  }

  try {
    const messageId = await prisma.$transaction(async (tx) => {
      const message = await tx.leadMessage.create({
        data: {
          leadId: lead.id,
          direction: "SALIENTE",
          channel: "WHATSAPP",
          body,
          normalizedText: normalizeMessage(body),
          status: "ENVIADO",
          externalId,
          sentById: user.id,
        },
      });

      // La plantilla no consume el borrador: queda para cuando la persona
      // responda y se abra la ventana.
      if (input.draftId && !viaTemplate) {
        await tx.leadDraft.updateMany({
          where: { id: input.draftId, leadId: lead.id },
          data: { status: "ENVIADO" },
        });
      }

      const now = new Date();
      const nextData: Prisma.LeadUpdateInput = {
        needsReply: false,
        lastMessageAt: now,
        ...(input.nextContactDays
          ? { nextContactAt: atBusinessHour(input.nextContactDays, 10, now) }
          : {}),
      };

      if (input.markPriceSent && !viaTemplate && lead.stage === LeadStage.CONSULTA) {
        await moveStage(tx, lead.id, LeadStage.PRECIO_ENVIADO, { userId: user.id, data: nextData });
      } else {
        await tx.lead.update({ where: { id: lead.id }, data: nextData });
      }

      await recordAudit(tx, {
        userId: user.id,
        action: "ENVIAR_MENSAJE",
        entity: "Lead",
        entityId: lead.id,
        changes: {
          canal: { anterior: null, nuevo: "WhatsApp" },
          ...(chosen ? { plantilla: { anterior: null, nuevo: chosen.entry.label } } : {}),
        },
      });

      return message.id;
    });

    return { status: "sent", messageId, viaTemplate };
  } catch (error) {
    // El índice único parcial de la base frena el doble clic: dos envíos
    // idénticos al mismo tiempo.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const last = previous[0];
      return {
        status: "blocked",
        kind: "exact",
        previousBody: last?.body ?? body,
        previousAt: last?.createdAt ?? new Date(),
      };
    }
    throw error;
  }
}
