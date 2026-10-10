import { LeadStage, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { atBusinessHour } from "@/lib/domain/follow-up";
import { normalizeMessage } from "@/lib/domain/messages";
import { recordAudit } from "../audit";
import { assertLeadAccess } from "./access";
import { moveStage } from "./stage";

export interface ManualReplyInput {
  leadId: string;
  /// Lo que se le mandó a la persona desde el WhatsApp propio de quien atiende.
  body: string;
  draftId?: string | null;
  markPriceSent?: boolean;
  nextContactDays?: number;
}

/**
 * Registra una respuesta que se mandó FUERA del sistema (desde el WhatsApp del
 * propio vendedor, o por teléfono), para que la consulta no siga figurando
 * como "esperando respuesta" y la conversación quede completa.
 *
 * No envía nada: solo deja asentado lo que ya se mandó. Sirve mientras el
 * sistema no tenga un número de WhatsApp propio que pueda escribirle a
 * cualquier cliente.
 */
export async function markRepliedManually(input: ManualReplyInput): Promise<void> {
  const user = await requirePermission("consultas.responder");
  await assertLeadAccess(user, input.leadId);

  const body = input.body.trim();
  if (body.length === 0) throw errors.validacion("Pegá o escribí lo que le mandaste.");
  if (body.length > 4000) throw errors.validacion("El mensaje es demasiado largo (máximo 4000 caracteres).");

  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { id: true, stage: true },
  });
  if (!lead) throw errors.noEncontrado("la consulta");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.leadMessage.create({
        data: {
          leadId: lead.id,
          direction: "SALIENTE",
          channel: "WHATSAPP",
          body,
          normalizedText: normalizeMessage(body),
          status: "ENVIADO",
          sentById: user.id,
        },
      });

      if (input.draftId) {
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

      if (input.markPriceSent && lead.stage === LeadStage.CONSULTA) {
        await moveStage(tx, lead.id, LeadStage.PRECIO_ENVIADO, { userId: user.id, data: nextData });
      } else {
        await tx.lead.update({ where: { id: lead.id }, data: nextData });
      }

      await recordAudit(tx, {
        userId: user.id,
        action: "ENVIAR_MENSAJE",
        entity: "Lead",
        entityId: lead.id,
        changes: { canal: { anterior: null, nuevo: "WhatsApp propio (registrado a mano)" } },
      });
    });
  } catch (error) {
    // El índice único parcial frena registrar dos veces el mismo texto.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw errors.conflicto("Ese mensaje ya figura como enviado a esta persona.");
    }
    throw error;
  }
}
