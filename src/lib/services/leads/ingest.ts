import { z } from "zod";
import { LeadStage, UserRole, UserStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeMessage } from "@/lib/domain/messages";
import { normalizeEmail, normalizePhone } from "@/lib/domain/phone";
import { CLOSED_LEAD_STAGES } from "@/lib/constants";
import { recordStageChange } from "./stage";

/**
 * Entrada común de todos los canales (formulario de la tienda y WhatsApp, reales
 * o simulados). Unifica a la persona por teléfono y por correo, guarda el
 * mensaje y deja la consulta lista para responder.
 *
 * No exige sesión: la usan webhooks y el formulario público. Por eso nada de lo
 * que entra por acá se confía: se valida todo.
 */

export const inboundSchema = z.object({
  channel: z.enum(["WEB", "WHATSAPP"]),
  fullName: z.string().trim().min(2, "Falta el nombre").max(120),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  /// Equipo de la tienda por el que consulta.
  deviceId: z.string().trim().max(40).optional(),
  body: z.string().trim().min(1, "Falta el mensaje").max(4000),
  /// Id del mensaje en el canal. Evita procesar dos veces el mismo aviso.
  externalId: z.string().max(200).optional(),
  receivedAt: z.date().optional(),
});

export type InboundInput = z.input<typeof inboundSchema>;

export type InboundResult =
  | { status: "duplicate-event" }
  | { status: "invalid"; error: string }
  | {
      status: "ok";
      leadId: string;
      created: boolean;
      unifiedBy: "phone" | "email" | null;
    };

/// Reparte las consultas nuevas: el vendedor activo con menos consultas
/// abiertas. Si no hay vendedores, el administrador con menos carga.
export async function pickAssigneeId(tx: Pick<Prisma.TransactionClient, "user" | "lead">): Promise<string | null> {
  for (const role of [UserRole.VENDEDOR, UserRole.ADMINISTRADOR]) {
    const users = await tx.user.findMany({
      where: { status: UserStatus.ACTIVO, role },
      select: { id: true },
    });
    if (users.length === 0) continue;

    const loads = await Promise.all(
      users.map(async (user) => ({
        id: user.id,
        open: await tx.lead.count({
          where: { assigneeId: user.id, stage: { notIn: [...CLOSED_LEAD_STAGES] } },
        }),
      })),
    );
    return loads.sort((a, b) => a.open - b.open)[0].id;
  }
  return null;
}

export async function ingestInbound(raw: InboundInput): Promise<InboundResult> {
  const parsed = inboundSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "invalid", error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const input = parsed.data;

  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (input.phone && !phone) return { status: "invalid", error: "El teléfono no es válido" };
  if (input.email && !email) return { status: "invalid", error: "El correo no es válido" };
  if (!phone && !email) return { status: "invalid", error: "Hace falta un teléfono o un correo" };

  if (
    input.externalId &&
    (await prisma.leadMessage.findUnique({
      where: { externalId: input.externalId },
      select: { id: true },
    }))
  ) {
    return { status: "duplicate-event" };
  }

  // El equipo solo se asocia si existe: un id inventado no rompe la consulta.
  const device = input.deviceId
    ? await prisma.device.findUnique({ where: { id: input.deviceId }, select: { id: true } })
    : null;

  const receivedAt = input.receivedAt ?? new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    const byPhone = phone ? await tx.lead.findUnique({ where: { phone } }) : null;
    const byEmail = email ? await tx.lead.findUnique({ where: { email } }) : null;
    const existing = byPhone ?? byEmail;
    const unifiedBy = byPhone ? ("phone" as const) : byEmail ? ("email" as const) : null;

    let leadId: string;

    if (existing) {
      leadId = existing.id;
      const data: Prisma.LeadUpdateInput = {
        lastInboundAt: receivedAt,
        lastMessageAt: receivedAt,
        needsReply: true,
      };

      // Se completa lo que faltaba; nunca se pisa lo que ya estaba cargado.
      if (!existing.phone && phone && !byPhone) data.phone = phone;
      if (!existing.email && email && !byEmail) data.email = email;
      if (!existing.deviceId && device) data.device = { connect: { id: device.id } };

      // Quien estaba en pausa, vendido o perdido y vuelve a escribir vuelve a
      // estar activo, y hay que contestarle hoy.
      const reopen =
        existing.stage === LeadStage.EN_PAUSA ||
        existing.stage === LeadStage.PERDIDO ||
        existing.stage === LeadStage.VENDIDO;

      if (reopen) {
        data.stage = LeadStage.CONSULTA;
        data.stageChangedAt = receivedAt;
        data.nextContactAt = receivedAt;
        data.pauseReason = null;
        data.lostReason = null;
        if (device) data.device = { connect: { id: device.id } };
        await recordStageChange(tx, {
          leadId,
          from: existing.stage,
          to: LeadStage.CONSULTA,
          at: receivedAt,
        });
      }

      await tx.lead.update({ where: { id: leadId }, data });
    } else {
      const created = await tx.lead.create({
        data: {
          fullName: input.fullName,
          phone,
          email,
          source: input.channel,
          stage: LeadStage.CONSULTA,
          assigneeId: await pickAssigneeId(tx),
          deviceId: device?.id,
          nextContactAt: receivedAt,
          lastInboundAt: receivedAt,
          lastMessageAt: receivedAt,
          needsReply: true,
        },
      });
      leadId = created.id;
      await recordStageChange(tx, { leadId, from: null, to: LeadStage.CONSULTA, at: receivedAt });
    }

    await tx.leadMessage.create({
      data: {
        leadId,
        direction: "ENTRANTE",
        channel: input.channel,
        body: input.body,
        normalizedText: normalizeMessage(input.body),
        status: "RECIBIDO",
        externalId: input.externalId,
        createdAt: receivedAt,
      },
    });

    return { leadId, created: !existing, unifiedBy };
  });

  return { status: "ok", ...outcome };
}
