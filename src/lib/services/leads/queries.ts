import {
  UserRole,
  UserStatus,
  type LeadPriority,
  type LeadSource,
  type LeadStage,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { CLOSED_LEAD_STAGES, PAGE_SIZE } from "@/lib/constants";
import { dueInfo, isClosed } from "@/lib/domain/follow-up";
import { startOfBusinessToday } from "@/lib/domain/installments";
import { toNumber } from "@/lib/serialize";
import { visibleLeadsWhere } from "./access";

/// La prioridad que se muestra: la que fijó una persona manda sobre la de la IA.
export function effectivePriority(lead: {
  manualPriority: LeadPriority | null;
  aiPriority: LeadPriority | null;
}): LeadPriority | null {
  return lead.manualPriority ?? lead.aiPriority;
}

const PRIORITY_RANK: Record<LeadPriority, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

const deviceLabel = (device: { model: { name: string; brand: { name: string } } } | null) =>
  device ? `${device.model.brand.name} ${device.model.name}` : null;

// ---------------------------------------------------------------------------
// Bandeja
// ---------------------------------------------------------------------------

export interface InboxFilters {
  show: "sin_responder" | "todas";
  who: "todos" | "mias" | "sin_asignar";
  page: number;
}

export interface InboxItem {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  needsReply: boolean;
  stage: LeadStage;
  priority: LeadPriority | null;
  priorityReason: string | null;
  assigneeName: string | null;
  deviceName: string | null;
  lastMessage: { direction: "ENTRANTE" | "SALIENTE"; body: string; createdAt: Date } | null;
  lastMessageAt: Date | null;
}

export async function listInbox(filters: InboxFilters) {
  const user = await requirePermission("consultas.ver_propias");
  const seesAll = can(user.role, "consultas.ver_todas");

  const where: Prisma.LeadWhereInput = {
    ...visibleLeadsWhere(user),
    ...(filters.show === "sin_responder" ? { needsReply: true } : {}),
    // Los filtros de responsable solo tienen sentido para quien ve todo.
    ...(seesAll && filters.who === "mias" ? { assigneeId: user.id } : {}),
    ...(seesAll && filters.who === "sin_asignar" ? { assigneeId: null } : {}),
  };

  const todayStart = startOfBusinessToday();

  const [total, rows, unanswered, newToday] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy: [{ needsReply: "desc" }, { lastMessageAt: { sort: "desc", nulls: "last" } }],
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        needsReply: true,
        stage: true,
        manualPriority: true,
        aiPriority: true,
        aiPriorityReason: true,
        lastMessageAt: true,
        assignee: { select: { firstName: true, lastName: true } },
        device: { select: { model: { select: { name: true, brand: { select: { name: true } } } } } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { direction: true, body: true, createdAt: true },
        },
      },
    }),
    prisma.lead.count({ where: { ...visibleLeadsWhere(user), needsReply: true } }),
    prisma.lead.count({ where: { ...visibleLeadsWhere(user), createdAt: { gte: todayStart } } }),
  ]);

  const items: InboxItem[] = rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    phone: row.phone,
    email: row.email,
    needsReply: row.needsReply,
    stage: row.stage,
    priority: effectivePriority(row),
    priorityReason: row.manualPriority ? "Fijada a mano" : row.aiPriorityReason,
    assigneeName: row.assignee ? `${row.assignee.firstName} ${row.assignee.lastName}` : null,
    deviceName: deviceLabel(row.device),
    lastMessage: row.messages[0] ?? null,
    lastMessageAt: row.lastMessageAt,
  }));

  // Dentro de lo que espera respuesta, lo más urgente primero.
  items.sort((a, b) => {
    if (a.needsReply !== b.needsReply) return a.needsReply ? -1 : 1;
    const pa = a.priority ? PRIORITY_RANK[a.priority] : 3;
    const pb = b.priority ? PRIORITY_RANK[b.priority] : 3;
    return a.needsReply && pa !== pb ? pa - pb : 0;
  });

  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    unanswered,
    newToday,
    seesAll,
  };
}

// ---------------------------------------------------------------------------
// Detalle de una consulta
// ---------------------------------------------------------------------------

export async function getLeadDetail(id: string) {
  const user = await requirePermission("consultas.ver_propias");
  const seesAll = can(user.role, "consultas.ver_todas");

  const lead = await prisma.lead.findFirst({
    where: { id, ...visibleLeadsWhere(user) },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      source: true,
      stage: true,
      stageChangedAt: true,
      interestNote: true,
      nextContactAt: true,
      nextContactNote: true,
      pauseReason: true,
      lostReason: true,
      manualPriority: true,
      aiPriority: true,
      aiPriorityReason: true,
      needsReply: true,
      lastInboundAt: true,
      createdAt: true,
      assigneeId: true,
      assignee: { select: { firstName: true, lastName: true } },
      device: {
        select: {
          id: true,
          color: true,
          storageGb: true,
          condition: true,
          batteryPercent: true,
          salePrice: true,
          inventoryStatus: true,
          model: { select: { name: true, brand: { select: { name: true } } } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          direction: true,
          channel: true,
          body: true,
          status: true,
          createdAt: true,
          sentBy: { select: { firstName: true, lastName: true } },
        },
      },
      drafts: {
        where: { status: "PENDIENTE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, body: true, generatedBy: true, createdAt: true },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          body: true,
          createdAt: true,
          authorId: true,
          author: { select: { firstName: true, lastName: true } },
        },
      },
      stageChanges: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          fromStage: true,
          toStage: true,
          createdAt: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!lead) throw errors.noEncontrado("la consulta");

  const lastWhatsapp = [...lead.messages]
    .reverse()
    .find((m) => m.direction === "ENTRANTE" && m.channel === "WHATSAPP");

  return {
    id: lead.id,
    fullName: lead.fullName,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    stage: lead.stage,
    stageChangedAt: lead.stageChangedAt,
    interestNote: lead.interestNote,
    nextContactAt: lead.nextContactAt,
    nextContactNote: lead.nextContactNote,
    pauseReason: lead.pauseReason,
    lostReason: lead.lostReason,
    manualPriority: lead.manualPriority,
    aiPriority: lead.aiPriority,
    aiPriorityReason: lead.aiPriorityReason,
    needsReply: lead.needsReply,
    createdAt: lead.createdAt,
    assigneeId: lead.assigneeId,
    assigneeName: lead.assignee ? `${lead.assignee.firstName} ${lead.assignee.lastName}` : null,
    /// Último mensaje que la persona mandó por WhatsApp: define la ventana de 24 h.
    lastWhatsappInboundAt: lastWhatsapp?.createdAt ?? null,
    device: lead.device
      ? {
          id: lead.device.id,
          title: deviceLabel(lead.device)!,
          color: lead.device.color,
          storageGb: lead.device.storageGb,
          condition: lead.device.condition,
          batteryPercent: lead.device.batteryPercent,
          salePrice: toNumber(lead.device.salePrice),
          inventoryStatus: lead.device.inventoryStatus,
        }
      : null,
    messages: lead.messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      channel: m.channel,
      body: m.body,
      status: m.status,
      createdAt: m.createdAt,
      senderName: m.sentBy ? `${m.sentBy.firstName} ${m.sentBy.lastName}` : null,
    })),
    draft: lead.drafts[0] ?? null,
    notes: lead.notes.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.createdAt,
      authorName: `${n.author.firstName} ${n.author.lastName}`,
      /// Cada persona borra las suyas; el administrador, cualquiera.
      canDelete: seesAll || n.authorId === user.id,
    })),
    stageChanges: lead.stageChanges.map((c) => ({
      id: c.id,
      fromStage: c.fromStage,
      toStage: c.toStage,
      createdAt: c.createdAt,
      userName: c.user ? `${c.user.firstName} ${c.user.lastName}` : null,
    })),
    canReassign: can(user.role, "consultas.gestionar"),
  };
}

export type LeadDetail = Awaited<ReturnType<typeof getLeadDetail>>;

/// Personas a las que se les puede asignar una consulta.
export async function listAssignable() {
  await requirePermission("consultas.ver_propias");
  const users = await prisma.user.findMany({
    where: { status: UserStatus.ACTIVO },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, role: true },
  });
  return users.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    role: u.role,
  }));
}

// ---------------------------------------------------------------------------
// Tablero de seguimiento
// ---------------------------------------------------------------------------

export interface BoardFilters {
  assignee?: string;
  source?: LeadSource;
}

export interface BoardCard {
  id: string;
  fullName: string;
  stage: LeadStage;
  source: string;
  assigneeName: string | null;
  deviceName: string | null;
  nextContactAt: Date | null;
  nextContactNote: string | null;
  priority: LeadPriority | null;
  needsReply: boolean;
}

export async function getBoard(filters: BoardFilters) {
  const user = await requirePermission("consultas.ver_propias");
  const seesAll = can(user.role, "consultas.ver_todas");

  const rows = await prisma.lead.findMany({
    where: {
      ...visibleLeadsWhere(user),
      ...(seesAll && filters.assignee === "mias" ? { assigneeId: user.id } : {}),
      ...(seesAll && filters.assignee === "sin_asignar" ? { assigneeId: null } : {}),
      ...(seesAll && filters.assignee && !["mias", "sin_asignar"].includes(filters.assignee)
        ? { assigneeId: filters.assignee }
        : {}),
      ...(filters.source ? { source: filters.source } : {}),
    },
    orderBy: [{ nextContactAt: { sort: "asc", nulls: "last" } }, { fullName: "asc" }],
    take: 1000,
    select: {
      id: true,
      fullName: true,
      stage: true,
      source: true,
      nextContactAt: true,
      nextContactNote: true,
      manualPriority: true,
      aiPriority: true,
      needsReply: true,
      assignee: { select: { firstName: true, lastName: true } },
      device: { select: { model: { select: { name: true, brand: { select: { name: true } } } } } },
    },
  });

  const cards: BoardCard[] = rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    stage: row.stage,
    source: row.source,
    assigneeName: row.assignee ? `${row.assignee.firstName} ${row.assignee.lastName}` : null,
    deviceName: deviceLabel(row.device),
    nextContactAt: row.nextContactAt,
    nextContactNote: row.nextContactNote,
    priority: effectivePriority(row),
    needsReply: row.needsReply,
  }));

  let today = 0;
  let overdue = 0;
  for (const card of cards) {
    if (isClosed(card.stage)) continue;
    const status = dueInfo(card.nextContactAt).status;
    if (status === "today") today++;
    if (status === "overdue") overdue++;
  }

  return { cards, open: cards.filter((c) => !isClosed(c.stage)).length, today, overdue, seesAll };
}

/// Consultas abiertas con próximo contacto hoy o vencido. Sin sesión: la usa
/// el aviso diario.
export async function getDueLeads(options: { assigneeId?: string; now?: Date } = {}) {
  const now = options.now ?? new Date();
  // Fin del día de hoy en el local (UTC-3), con margen: dueInfo decide el estado exacto.
  const limit = new Date(startOfBusinessToday(now).getTime() + 27 * 3_600_000);

  const rows = await prisma.lead.findMany({
    where: {
      stage: { notIn: [...CLOSED_LEAD_STAGES] },
      nextContactAt: { not: null, lt: limit },
      ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
    },
    orderBy: { nextContactAt: "asc" },
    select: {
      id: true,
      fullName: true,
      stage: true,
      nextContactAt: true,
      nextContactNote: true,
      pauseReason: true,
      assigneeId: true,
      assignee: { select: { firstName: true, lastName: true } },
      device: { select: { model: { select: { name: true, brand: { select: { name: true } } } } } },
    },
  });

  return rows
    .filter((row) => {
      const status = dueInfo(row.nextContactAt, now).status;
      return status === "overdue" || status === "today";
    })
    .map((row) => ({
      id: row.id,
      fullName: row.fullName,
      stage: row.stage,
      nextContactAt: row.nextContactAt,
      nextContactNote: row.nextContactNote,
      pauseReason: row.pauseReason,
      assigneeId: row.assigneeId,
      assigneeName: row.assignee ? `${row.assignee.firstName} ${row.assignee.lastName}` : null,
      deviceName: deviceLabel(row.device),
    }));
}

/// "Mi día": lo mío; si no tengo nada asignado, lo del equipo.
export async function getMyDay() {
  const user = await requirePermission("consultas.ver_propias");
  const mine = await getDueLeads({ assigneeId: user.id });
  if (mine.length > 0 || !can(user.role, "consultas.ver_todas")) return { list: mine, mine: true };
  return { list: await getDueLeads(), mine: false };
}

// ---------------------------------------------------------------------------
// Equipo y carga (solo administración)
// ---------------------------------------------------------------------------

export async function getTeamLoad() {
  await requirePermission("consultas.gestionar");

  const users = await prisma.user.findMany({
    where: { status: UserStatus.ACTIVO, role: { in: [UserRole.VENDEDOR, UserRole.ADMINISTRADOR] } },
    orderBy: [{ firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  const open = await prisma.lead.findMany({
    where: { stage: { notIn: [...CLOSED_LEAD_STAGES] } },
    select: { assigneeId: true, needsReply: true, nextContactAt: true },
  });

  const rows = users.map((u) => {
    const mine = open.filter((l) => l.assigneeId === u.id);
    let today = 0;
    let overdue = 0;
    for (const lead of mine) {
      const status = dueInfo(lead.nextContactAt).status;
      if (status === "today") today++;
      if (status === "overdue") overdue++;
    }
    return {
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      role: u.role,
      open: mine.length,
      unanswered: mine.filter((l) => l.needsReply).length,
      today,
      overdue,
    };
  });

  return { rows, unassigned: open.filter((l) => l.assigneeId === null).length };
}
