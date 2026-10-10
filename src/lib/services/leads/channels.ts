import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { describeWhatsAppError } from "@/lib/integrations/whatsapp/rules";
import type { WaParsed } from "@/lib/integrations/whatsapp/payload";
import {
  aiMode,
  aiModel,
} from "@/lib/ai";
import {
  enforceWindow,
  metaAppSecret,
  whatsappMode,
  whatsappVerifyToken,
  availableTemplates,
} from "@/lib/integrations/whatsapp/client";
import { appUrl } from "@/lib/app-url";
import { ingestInbound } from "./ingest";

export interface LogEntry {
  source: string;
  signatureOk: boolean;
  kind?: string;
  externalId?: string;
  outcome: "ok" | "ignored" | "error" | "rejected";
  detail?: string;
}

/// Registra lo que llega por un webhook. Nunca debe romper el procesamiento.
export async function logWebhook(entry: LogEntry): Promise<void> {
  try {
    await prisma.webhookLog.create({
      data: {
        source: entry.source,
        signatureOk: entry.signatureOk,
        kind: entry.kind,
        externalId: entry.externalId,
        outcome: entry.outcome,
        detail: entry.detail?.slice(0, 300),
      },
    });
  } catch (error) {
    console.error("[webhook] No se pudo registrar el aviso:", error);
  }
}

export interface ChannelSummary {
  received: number;
  duplicates: number;
  failed: number;
  leadIds: string[];
}

/// Rango de los estados de entrega: solo avanzan (enviado → entregado → leído).
const STATUS_RANK = { ENVIADO: 1, ENTREGADO: 2, LEIDO: 3 } as const;

/// Procesa los mensajes y estados de un aviso de WhatsApp. Cada elemento se
/// maneja por separado: uno roto no frena al resto.
export async function handleWhatsAppEvents(parsed: WaParsed): Promise<ChannelSummary> {
  const summary: ChannelSummary = { received: 0, duplicates: 0, failed: 0, leadIds: [] };

  for (const message of parsed.messages) {
    try {
      const result = await ingestInbound({
        channel: "WHATSAPP",
        fullName: message.name || `WhatsApp +${message.from}`,
        phone: `+${message.from}`,
        body: message.text,
        externalId: message.id,
        receivedAt: message.at,
      });

      if (result.status === "ok") {
        summary.received++;
        if (!summary.leadIds.includes(result.leadId)) summary.leadIds.push(result.leadId);
        await logWebhook({
          source: "whatsapp",
          signatureOk: true,
          kind: "message",
          externalId: message.id,
          outcome: "ok",
          detail: result.created ? "Persona nueva" : "Persona existente",
        });
      } else if (result.status === "duplicate-event") {
        summary.duplicates++;
        await logWebhook({
          source: "whatsapp",
          signatureOk: true,
          kind: "message",
          externalId: message.id,
          outcome: "ignored",
          detail: "Aviso repetido",
        });
      } else {
        summary.failed++;
        await logWebhook({
          source: "whatsapp",
          signatureOk: true,
          kind: "message",
          externalId: message.id,
          outcome: "error",
          detail: result.error,
        });
      }
    } catch (error) {
      summary.failed++;
      console.error("[whatsapp] Error procesando un mensaje:", error);
      await logWebhook({
        source: "whatsapp",
        signatureOk: true,
        kind: "message",
        externalId: message.id,
        outcome: "error",
        detail: (error as Error).message,
      });
    }
  }

  for (const status of parsed.statuses) {
    try {
      const message = await prisma.leadMessage.findUnique({
        where: { externalId: status.id },
        select: { id: true, status: true, direction: true },
      });

      if (!message || message.direction !== "SALIENTE") {
        await logWebhook({
          source: "whatsapp",
          signatureOk: true,
          kind: "status",
          externalId: status.id,
          outcome: "ignored",
          detail: "Mensaje desconocido",
        });
        continue;
      }

      if (status.status === "failed") {
        await prisma.leadMessage.update({ where: { id: message.id }, data: { status: "FALLIDO" } });
        await logWebhook({
          source: "whatsapp",
          signatureOk: true,
          kind: "status",
          externalId: status.id,
          outcome: "ok",
          detail: `Falló: ${describeWhatsAppError(status.errorCode, status.errorTitle)}`,
        });
        continue;
      }

      const next = status.status === "sent" ? "ENVIADO" : status.status === "delivered" ? "ENTREGADO" : "LEIDO";
      const current = message.status as keyof typeof STATUS_RANK;
      // Un aviso atrasado no retrocede el estado.
      if (!(current in STATUS_RANK) || STATUS_RANK[next] > STATUS_RANK[current]) {
        await prisma.leadMessage.update({ where: { id: message.id }, data: { status: next } });
      }
      await logWebhook({
        source: "whatsapp",
        signatureOk: true,
        kind: "status",
        externalId: status.id,
        outcome: "ok",
        detail: next,
      });
    } catch (error) {
      summary.failed++;
      console.error("[whatsapp] Error procesando un estado:", error);
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// Pantalla "Canales" (solo administración)
// ---------------------------------------------------------------------------

export interface ChannelsStatus {
  whatsapp: {
    mode: "mock" | "live";
    ready: boolean;
    missing: string[];
    webhookUrl: string;
    verifyToken: string;
    templates: Array<{ key: string; label: string; name: string }>;
    enforcesWindow: boolean;
  };
  ai: { mode: "groq" | "mock"; model: string };
  cron: { configured: boolean };
  log: Array<{
    id: string;
    createdAt: Date;
    source: string;
    kind: string | null;
    outcome: string;
    detail: string | null;
    signatureOk: boolean;
  }>;
}

export async function getChannelsStatus(): Promise<ChannelsStatus> {
  await requirePermission("consultas.gestionar");

  const mode = whatsappMode();
  const missing: string[] = [];
  if (mode === "live") {
    if (!process.env.WHATSAPP_PHONE_NUMBER_ID) missing.push("WHATSAPP_PHONE_NUMBER_ID");
    if (!process.env.WHATSAPP_ACCESS_TOKEN) missing.push("WHATSAPP_ACCESS_TOKEN");
    if (!metaAppSecret()) missing.push("META_APP_SECRET");
    if (!whatsappVerifyToken()) missing.push("WHATSAPP_VERIFY_TOKEN");
  }

  const log = await prisma.webhookLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      createdAt: true,
      source: true,
      kind: true,
      outcome: true,
      detail: true,
      signatureOk: true,
    },
  });

  return {
    whatsapp: {
      mode,
      ready: missing.length === 0,
      missing,
      webhookUrl: `${appUrl()}/api/webhooks/whatsapp`,
      verifyToken: whatsappVerifyToken(),
      templates: availableTemplates().map((t) => ({
        key: t.entry.key,
        label: t.entry.label,
        name: t.template.name,
      })),
      enforcesWindow: enforceWindow(),
    },
    ai: { mode: aiMode(), model: aiModel() },
    cron: { configured: (process.env.CRON_SECRET ?? "").length >= 16 },
    log,
  };
}
