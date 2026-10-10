import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { buildDigest } from "@/lib/domain/follow-up";
import { businessDay, calendarDayToDate } from "@/lib/domain/installments";
import { appUrl } from "@/lib/app-url";
import { recordAudit } from "../audit";
import { getDueLeads } from "./queries";

export interface DigestRunResult {
  date: string;
  sent: Array<{ user: string; today: number; overdue: number }>;
  skipped: Array<{ user: string; reason: string }>;
}

/**
 * Aviso diario: a cada persona con consultas asignadas le llega lo que vence
 * hoy y lo que está vencido. Es idempotente por (persona, día): si el cron corre
 * dos veces, el segundo intento no vuelve a avisar.
 *
 * Por ahora el aviso queda guardado y se ve en Seguimiento → Avisos (y en el
 * log del servidor): no se manda correo real hasta conectar un proveedor.
 */
export async function runDailyDigest(options: { now?: Date } = {}): Promise<DigestRunResult> {
  const now = options.now ?? new Date();
  const forDate = calendarDayToDate(businessDay(now));
  const result: DigestRunResult = { date: businessDay(now), sent: [], skipped: [] };

  const due = await getDueLeads({ now });
  const byUser = new Map<string, typeof due>();
  for (const lead of due) {
    if (!lead.assigneeId) continue;
    byUser.set(lead.assigneeId, [...(byUser.get(lead.assigneeId) ?? []), lead]);
  }

  const users = await prisma.user.findMany({
    where: { status: "ACTIVO", id: { in: [...byUser.keys()] } },
    select: { id: true, firstName: true, lastName: true },
  });

  for (const user of users) {
    const name = `${user.firstName} ${user.lastName}`;
    const digest = buildDigest(name, byUser.get(user.id) ?? [], appUrl(), now);

    if (!digest) {
      result.skipped.push({ user: name, reason: "nada para avisar" });
      continue;
    }

    const already = await prisma.staffNotification.findUnique({
      where: { userId_kind_forDate: { userId: user.id, kind: "daily_digest", forDate } },
      select: { id: true },
    });
    if (already) {
      result.skipped.push({ user: name, reason: "ya se avisó hoy" });
      continue;
    }

    console.info(`[aviso diario simulado] → ${name}: ${digest.subject}`);
    await prisma.staffNotification.create({
      data: {
        userId: user.id,
        kind: "daily_digest",
        forDate,
        subject: digest.subject,
        body: digest.body,
        dueToday: digest.today,
        overdue: digest.overdue,
        channel: "registro",
      },
    });
    result.sent.push({ user: name, today: digest.today, overdue: digest.overdue });
  }

  return result;
}

/// Genera los avisos a mano desde la pantalla (solo administración).
export async function runDigestAsAdmin(): Promise<DigestRunResult> {
  const user = await requirePermission("consultas.gestionar");
  const result = await runDailyDigest();

  await recordAudit(prisma, {
    userId: user.id,
    action: "GENERAR_AVISOS",
    entity: "System",
    entityId: result.date,
    changes: {
      avisos: { anterior: 0, nuevo: result.sent.length },
    },
  });
  return result;
}

export async function listDigests(limit = 30) {
  await requirePermission("consultas.gestionar");

  const rows = await prisma.staffNotification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      subject: true,
      body: true,
      dueToday: true,
      overdue: true,
      createdAt: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    body: row.body,
    dueToday: row.dueToday,
    overdue: row.overdue,
    createdAt: row.createdAt,
    userName: `${row.user.firstName} ${row.user.lastName}`,
  }));
}
