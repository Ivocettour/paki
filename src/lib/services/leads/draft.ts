import { InventoryStatus, type LeadPriority, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { classifyAndDraft } from "@/lib/ai";
import type {
  CatalogItem,
  DraftInput,
  DraftStyle,
  InterestDevice,
} from "@/lib/ai/types";
import { DEFAULT_SIMILARITY_THRESHOLD, findDuplicate } from "@/lib/domain/messages";
import { DEVICE_CONDITION_LABELS, formatStorage } from "@/lib/constants";
import { toNumber } from "@/lib/serialize";
import { storeConfig } from "@/lib/store-config";

/// Cuántos equipos disponibles se le muestran a la IA como catálogo.
const CATALOG_LIMIT = 30;
const HISTORY_LIMIT = 40;

const DEVICE_SELECT = {
  type: true,
  color: true,
  storageGb: true,
  condition: true,
  batteryPercent: true,
  salePrice: true,
  inventoryStatus: true,
  model: { select: { name: true, brand: { select: { name: true } } } },
} satisfies Prisma.DeviceSelect;

type DeviceRow = Prisma.DeviceGetPayload<{ select: typeof DEVICE_SELECT }>;

function toInterest(row: DeviceRow): InterestDevice {
  return {
    title: `${row.model.brand.name} ${row.model.name}`,
    condition: DEVICE_CONDITION_LABELS[row.condition],
    storage: row.storageGb ? formatStorage(row.storageGb) : null,
    color: row.color,
    batteryPercent: row.batteryPercent,
    price: toNumber(row.salePrice),
    available: row.inventoryStatus === InventoryStatus.DISPONIBLE,
  };
}

/// Todo lo que la IA necesita saber para escribir. Sin sesión: lo usa el webhook.
export async function loadDraftInput(leadId: string): Promise<DraftInput | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      fullName: true,
      stage: true,
      source: true,
      interestNote: true,
      assignee: { select: { firstName: true, lastName: true } },
      device: { select: DEVICE_SELECT },
      messages: {
        orderBy: { createdAt: "desc" },
        take: HISTORY_LIMIT,
        select: {
          direction: true,
          body: true,
          createdAt: true,
          sentBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!lead) return null;

  const [catalogRows, plans] = await Promise.all([
    prisma.device.findMany({
      where: { inventoryStatus: InventoryStatus.DISPONIBLE },
      orderBy: { entryDate: "desc" },
      take: CATALOG_LIMIT,
      select: DEVICE_SELECT,
    }),
    prisma.financingPlan.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { installments: "asc" }],
      select: { type: true, installments: true, surchargePercent: true },
    }),
  ]);

  const catalog: CatalogItem[] = catalogRows.map((row) => {
    const item = toInterest(row);
    return { title: item.title, condition: item.condition, storage: item.storage, price: item.price };
  });

  return {
    lead: {
      fullName: lead.fullName,
      stage: lead.stage,
      source: lead.source,
      interestNote: lead.interestNote,
      device: lead.device ? toInterest(lead.device) : null,
    },
    signerName: lead.assignee
      ? `${lead.assignee.firstName} ${lead.assignee.lastName}`
      : `el equipo de ${storeConfig.name}`,
    // Se guardó del más nuevo al más viejo; la IA lo lee en orden cronológico.
    history: [...lead.messages].reverse().map((message) => ({
      direction: message.direction === "ENTRANTE" ? ("IN" as const) : ("OUT" as const),
      at: message.createdAt,
      body: message.body,
      by: message.sentBy ? `${message.sentBy.firstName} ${message.sentBy.lastName}` : null,
    })),
    store: {
      name: storeConfig.name,
      address: storeConfig.address,
      hours: storeConfig.hours,
      plans: plans.map((plan) => ({
        type: plan.type,
        installments: plan.installments,
        surchargePercent: toNumber(plan.surchargePercent),
      })),
    },
    catalog,
  };
}

export interface GeneratedDraft {
  id: string;
  body: string;
  generatedBy: string;
  warning?: string;
  repeats: boolean;
}

/**
 * Genera (o regenera) el borrador de respuesta de una consulta. La IA ve todo
 * el historial. Si el borrador resulta casi igual a algo que ya se envió, se
 * pide una vez más una versión distinta. Nunca se envía solo.
 */
export async function generateDraft(
  leadId: string,
  options: { style?: DraftStyle } = {},
): Promise<GeneratedDraft | null> {
  const input = await loadDraftInput(leadId);
  if (!input) return null;

  let result = await classifyAndDraft({ ...input, style: options.style ?? "normal" });

  const previous = await prisma.leadMessage.findMany({
    where: { leadId, direction: "SALIENTE", status: { not: "FALLIDO" } },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, body: true, normalizedText: true, createdAt: true },
  });

  let repeats = findDuplicate(result.draft, previous, DEFAULT_SIMILARITY_THRESHOLD) !== null;
  if (repeats) {
    result = await classifyAndDraft({ ...input, style: "regenerate" });
    repeats = findDuplicate(result.draft, previous, DEFAULT_SIMILARITY_THRESHOLD) !== null;
  }

  const priority = result.classification.priority;
  const interestNote = result.classification.interestNote;

  const draft = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: leadId },
      select: { interestNote: true },
    });

    // Completa solo lo que todavía no se sabía; lo que cargó una persona no se pisa.
    // La sugerencia de prioridad se actualiza con cada mensaje; la manual no se toca.
    await tx.lead.update({
      where: { id: leadId },
      data: {
        ...(!lead?.interestNote && interestNote ? { interestNote: interestNote.slice(0, 200) } : {}),
        ...(priority
          ? {
              aiPriority: priority.level as LeadPriority,
              aiPriorityReason: priority.reason.slice(0, 200) || null,
            }
          : {}),
      },
    });

    await tx.leadDraft.updateMany({
      where: { leadId, status: "PENDIENTE" },
      data: { status: "DESCARTADO" },
    });
    return tx.leadDraft.create({
      data: { leadId, body: result.draft, generatedBy: result.generatedBy },
    });
  });

  return {
    id: draft.id,
    body: draft.body,
    generatedBy: draft.generatedBy,
    warning: result.warning,
    repeats,
  };
}
