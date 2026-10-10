import { LeadStage, LeadSource, UserStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { LEAD_STAGE_LABELS } from "@/lib/constants";
import { atBusinessHour, isClosed } from "@/lib/domain/follow-up";
import { normalizeEmail, normalizePhone } from "@/lib/domain/phone";
import { diffFields, recordAudit } from "../audit";
import { assertLeadAccess } from "./access";
import { pickAssigneeId } from "./ingest";
import { moveStage, recordStageChange } from "./stage";
import type { ManualLeadInput, UpdateFollowUpInput } from "@/lib/validations/leads";

/// "2026-10-14" → ese día a las 10:00, hora del local.
function contactDateToInstant(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  // 10:00 en UTC-3 = 13:00 UTC.
  return new Date(Date.UTC(year, month - 1, day, 13));
}

const AUDITED = ["stage", "nextContactAt", "nextContactNote", "pauseReason", "lostReason", "manualPriority", "interestNote"] as const;

/// Cambia etapa, próximo contacto, motivos y prioridad de una consulta.
export async function updateFollowUp(leadId: string, input: UpdateFollowUpInput): Promise<void> {
  const user = await requirePermission("consultas.responder");
  await assertLeadAccess(user, leadId);

  const current = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      stage: true,
      nextContactAt: true,
      nextContactNote: true,
      pauseReason: true,
      lostReason: true,
      manualPriority: true,
      interestNote: true,
    },
  });
  if (!current) throw errors.noEncontrado("la consulta");

  const closed = isClosed(input.stage);

  const next = {
    stage: input.stage,
    // Una consulta cerrada ya no tiene un próximo contacto que perseguir.
    nextContactAt: closed
      ? null
      : input.nextContactDate
        ? contactDateToInstant(input.nextContactDate)
        : null,
    nextContactNote: closed ? null : input.nextContactNote || null,
    pauseReason: input.stage === LeadStage.EN_PAUSA ? input.pauseReason || null : null,
    lostReason: input.stage === LeadStage.PERDIDO ? input.lostReason || null : null,
    manualPriority: input.manualPriority ?? null,
    interestNote: input.interestNote || null,
  };

  const changes = diffFields(current, next, AUDITED);
  if (Object.keys(changes).length === 0) return;

  await prisma.$transaction(async (tx) => {
    const { stage, ...rest } = next;
    await moveStage(tx, leadId, stage, { userId: user.id, data: rest });

    if (changes.stage) {
      changes.stage = {
        anterior: LEAD_STAGE_LABELS[current.stage],
        nuevo: LEAD_STAGE_LABELS[input.stage],
      };
    }
    await recordAudit(tx, {
      userId: user.id,
      action: "MODIFICAR_SEGUIMIENTO",
      entity: "Lead",
      entityId: leadId,
      changes,
    });
  });
}

/// Reprograma el próximo contacto sin tocar nada más (3 días, 1 semana…).
export async function snoozeLead(leadId: string, days: number): Promise<void> {
  const user = await requirePermission("consultas.responder");
  await assertLeadAccess(user, leadId);

  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw errors.validacion("Elegí entre 1 y 365 días.");
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { stage: true, nextContactAt: true },
  });
  if (!lead) throw errors.noEncontrado("la consulta");
  if (isClosed(lead.stage)) throw errors.regla("Esta consulta está cerrada: no tiene próximo contacto.");

  const nextContactAt = atBusinessHour(days, 10);
  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadId }, data: { nextContactAt } });
    await recordAudit(tx, {
      userId: user.id,
      action: "MODIFICAR_SEGUIMIENTO",
      entity: "Lead",
      entityId: leadId,
      changes: {
        nextContactAt: {
          anterior: lead.nextContactAt?.toISOString() ?? null,
          nuevo: nextContactAt.toISOString(),
        },
      },
    });
  });
}

/// Pasa la consulta a otra persona. Solo administración.
export async function reassignLead(leadId: string, assigneeId: string | null): Promise<void> {
  const user = await requirePermission("consultas.gestionar");

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { assigneeId: true, assignee: { select: { firstName: true, lastName: true } } },
  });
  if (!lead) throw errors.noEncontrado("la consulta");
  if (lead.assigneeId === assigneeId) return;

  let nextName: string | null = null;
  if (assigneeId) {
    const target = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { firstName: true, lastName: true, status: true },
    });
    if (!target || target.status !== UserStatus.ACTIVO) {
      throw errors.regla("Esa persona no está activa.");
    }
    nextName = `${target.firstName} ${target.lastName}`;
  }

  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadId }, data: { assigneeId } });
    await recordAudit(tx, {
      userId: user.id,
      action: "REASIGNAR_CONSULTA",
      entity: "Lead",
      entityId: leadId,
      changes: {
        responsable: {
          anterior: lead.assignee ? `${lead.assignee.firstName} ${lead.assignee.lastName}` : null,
          nuevo: nextName,
        },
      },
    });
  });
}

/**
 * Pasa toda la cartera abierta de una persona a otra, o la reparte en partes
 * parecidas entre el resto del equipo. Sirve para vacaciones, licencias y bajas.
 */
export async function reassignPortfolio(
  fromUserId: string,
  to: { userId: string } | "reparto",
): Promise<{ moved: number }> {
  const user = await requirePermission("consultas.gestionar");

  const leads = await prisma.lead.findMany({
    where: { assigneeId: fromUserId, stage: { notIn: ["VENDIDO", "PERDIDO"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (leads.length === 0) return { moved: 0 };

  const targets =
    to === "reparto"
      ? await prisma.user.findMany({
          where: { status: UserStatus.ACTIVO, id: { not: fromUserId } },
          select: { id: true },
        })
      : await prisma.user.findMany({
          where: { status: UserStatus.ACTIVO, id: to.userId },
          select: { id: true },
        });

  if (targets.length === 0) throw errors.regla("No hay a quién pasarle las consultas.");
  if (to !== "reparto" && to.userId === fromUserId) {
    throw errors.regla("Elegí a otra persona.");
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, lead] of leads.entries()) {
      await tx.lead.update({
        where: { id: lead.id },
        data: { assigneeId: targets[index % targets.length].id },
      });
    }
    await recordAudit(tx, {
      userId: user.id,
      action: "REASIGNAR_CONSULTA",
      entity: "User",
      entityId: fromUserId,
      changes: { consultasTraspasadas: { anterior: 0, nuevo: leads.length } },
    });
  });

  return { moved: leads.length };
}

// ---------------------------------------------------------------------------
// Notas internas
// ---------------------------------------------------------------------------

/// Nunca se envían al cliente ni se le pasan a la IA. La auditoría registra que
/// hubo una nota, no su contenido.
export async function addNote(leadId: string, body: string): Promise<void> {
  const user = await requirePermission("consultas.responder");
  await assertLeadAccess(user, leadId);

  await prisma.$transaction(async (tx) => {
    await tx.leadNote.create({ data: { leadId, authorId: user.id, body } });
    await recordAudit(tx, {
      userId: user.id,
      action: "NOTA_INTERNA",
      entity: "Lead",
      entityId: leadId,
      changes: { nota: { anterior: null, nuevo: "agregada" } },
    });
  });
}

/// Cada persona borra las suyas; el administrador, cualquiera.
export async function deleteNote(noteId: string): Promise<void> {
  const user = await requirePermission("consultas.responder");

  const note = await prisma.leadNote.findUnique({
    where: { id: noteId },
    select: { id: true, leadId: true, authorId: true },
  });
  if (!note) throw errors.noEncontrado("la nota");
  await assertLeadAccess(user, note.leadId);

  if (note.authorId !== user.id && user.role !== "ADMINISTRADOR") {
    throw errors.sinPermisos("Solo podés borrar tus propias notas.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.leadNote.delete({ where: { id: noteId } });
    await recordAudit(tx, {
      userId: user.id,
      action: "NOTA_INTERNA",
      entity: "Lead",
      entityId: note.leadId,
      changes: { nota: { anterior: "agregada", nuevo: "borrada" } },
    });
  });
}

// ---------------------------------------------------------------------------
// Alta manual
// ---------------------------------------------------------------------------

/// Carga una persona que no escribió por ningún canal (recomendación, alguien
/// que pasó por el local). Avisa si ya existe en lugar de duplicarla.
export async function createManualLead(input: ManualLeadInput): Promise<{ id: string }> {
  const user = await requirePermission("consultas.responder");

  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);

  const existing = await prisma.lead.findFirst({
    where: { OR: [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])] },
    select: { id: true, fullName: true },
  });
  if (existing) {
    throw errors.conflicto(
      `Ya existe una consulta de ${existing.fullName} con ese teléfono o correo. Buscala en la bandeja.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    // Un vendedor se queda con la que carga; el administrador la reparte.
    const assigneeId = user.role === "VENDEDOR" ? user.id : await pickAssigneeId(tx);
    const now = new Date();

    const lead = await tx.lead.create({
      data: {
        fullName: input.fullName,
        phone,
        email,
        source: LeadSource.MANUAL,
        stage: LeadStage.CONSULTA,
        assigneeId,
        interestNote: input.interestNote || null,
        nextContactAt: now,
      } satisfies Prisma.LeadUncheckedCreateInput,
      select: { id: true },
    });

    await recordStageChange(tx, { leadId: lead.id, from: null, to: LeadStage.CONSULTA, userId: user.id });

    if (input.note) {
      await tx.leadNote.create({ data: { leadId: lead.id, authorId: user.id, body: input.note } });
    }

    await recordAudit(tx, {
      userId: user.id,
      action: "CREAR_CONTACTO",
      entity: "Lead",
      entityId: lead.id,
      changes: { contacto: { anterior: null, nuevo: input.fullName } },
    });

    return lead;
  });
}
