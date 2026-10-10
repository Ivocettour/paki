import type { LeadStage, Prisma } from "@prisma/client";

type Tx = Pick<Prisma.TransactionClient, "lead" | "leadStageChange">;

/// Deja asentado un cambio de etapa. No hace nada si la etapa no cambió.
export async function recordStageChange(
  tx: Pick<Prisma.TransactionClient, "leadStageChange">,
  input: {
    leadId: string;
    from: LeadStage | null;
    to: LeadStage;
    userId?: string | null;
    at?: Date;
  },
): Promise<void> {
  if (input.from === input.to) return;

  await tx.leadStageChange.create({
    data: {
      leadId: input.leadId,
      fromStage: input.from,
      toStage: input.to,
      userId: input.userId ?? null,
      createdAt: input.at ?? new Date(),
    },
  });
}

/// Mueve una consulta de etapa y lo registra, junto con el resto de los
/// cambios (próximo contacto, etc.) en la misma escritura.
export async function moveStage(
  tx: Tx,
  leadId: string,
  to: LeadStage,
  options: { userId?: string | null; at?: Date; data?: Prisma.LeadUpdateInput } = {},
): Promise<void> {
  const current = await tx.lead.findUnique({ where: { id: leadId }, select: { stage: true } });
  if (!current) return;

  const at = options.at ?? new Date();
  await tx.lead.update({
    where: { id: leadId },
    data: {
      ...options.data,
      stage: to,
      ...(current.stage !== to ? { stageChangedAt: at } : {}),
    },
  });
  await recordStageChange(tx, { leadId, from: current.stage, to, userId: options.userId, at });
}
