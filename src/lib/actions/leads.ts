"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { generateDraft } from "@/lib/services/leads/draft";
import { assertLeadAccess } from "@/lib/services/leads/access";
import { sendReply, type SendResult } from "@/lib/services/leads/send";
import { markRepliedManually } from "@/lib/services/leads/manual-reply";
import { recordIncomingMessage } from "@/lib/services/leads/incoming-manual";
import { after } from "next/server";
import {
  addNote,
  createManualLead,
  deleteNote,
  reassignLead,
  reassignPortfolio,
  snoozeLead,
  updateFollowUp,
} from "@/lib/services/leads/follow-up";
import { runDigestAsAdmin, type DigestRunResult } from "@/lib/services/leads/digest";
import { ingestInbound } from "@/lib/services/leads/ingest";
import { rewriteText } from "@/lib/ai";
import { storeConfig } from "@/lib/store-config";
import {
  incomingSchema,
  manualLeadSchema,
  manualReplySchema,
  noteSchema,
  sendReplySchema,
  simulatorSchema,
  updateFollowUpSchema,
} from "@/lib/validations/leads";
import { runAction, type ActionResult } from "./types";

function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw errors.validacion(
      "Revisá los datos ingresados.",
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }
  return result.data;
}

function revalidateLeads(leadId?: string) {
  revalidatePath("/consultas");
  revalidatePath("/seguimiento");
  if (leadId) revalidatePath(`/consultas/${leadId}`);
}

export async function sendReplyAction(input: unknown): Promise<ActionResult<SendResult>> {
  return runAction(async () => {
    const data = parseOrThrow(sendReplySchema, input);
    const result = await sendReply(data);
    revalidateLeads(data.leadId);
    return result;
  });
}

/// Anota un mensaje que un cliente mandó fuera del sistema (WhatsApp personal).
export async function recordIncomingAction(input: unknown): Promise<ActionResult<{ leadId: string }>> {
  return runAction(async () => {
    const data = parseOrThrow(incomingSchema, input);
    const { leadId } = await recordIncomingMessage(data);

    // El borrador se prepara después de responder: no hace falta esperarlo.
    after(async () => {
      try {
        await generateDraft(leadId);
      } catch (error) {
        console.error("[consulta] No se pudo preparar el borrador:", error);
      }
    });

    revalidateLeads(leadId);
    return { leadId };
  });
}

/// Deja registrada una respuesta que se mandó desde el WhatsApp propio.
export async function markRepliedAction(input: unknown): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(manualReplySchema, input);
    await markRepliedManually(data);
    revalidateLeads(data.leadId);
  });
}

export async function updateFollowUpAction(leadId: string, input: unknown): Promise<ActionResult<void>> {
  return runAction(async () => {
    await updateFollowUp(leadId, parseOrThrow(updateFollowUpSchema, input));
    revalidateLeads(leadId);
  });
}

export async function snoozeAction(leadId: string, days: number): Promise<ActionResult<void>> {
  return runAction(async () => {
    await snoozeLead(leadId, days);
    revalidateLeads(leadId);
  });
}

export async function reassignLeadAction(
  leadId: string,
  assigneeId: string | null,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    await reassignLead(leadId, assigneeId || null);
    revalidateLeads(leadId);
    revalidatePath("/seguimiento/equipo");
  });
}

export async function reassignPortfolioAction(
  fromUserId: string,
  target: string,
): Promise<ActionResult<{ moved: number }>> {
  return runAction(async () => {
    const result = await reassignPortfolio(
      fromUserId,
      target === "reparto" ? "reparto" : { userId: target },
    );
    revalidateLeads();
    revalidatePath("/seguimiento/equipo");
    return result;
  });
}

export async function addNoteAction(leadId: string, input: unknown): Promise<ActionResult<void>> {
  return runAction(async () => {
    await addNote(leadId, parseOrThrow(noteSchema, input).body);
    revalidatePath(`/consultas/${leadId}`);
  });
}

export async function deleteNoteAction(noteId: string, leadId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    await deleteNote(noteId);
    revalidatePath(`/consultas/${leadId}`);
  });
}

export async function createManualLeadAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const lead = await createManualLead(parseOrThrow(manualLeadSchema, input));
    revalidateLeads();
    return lead;
  });
}

/// Genera otro borrador (o una versión distinta) para una consulta.
export async function regenerateDraftAction(
  leadId: string,
  style: "normal" | "regenerate" = "regenerate",
): Promise<ActionResult<{ body: string; warning?: string }>> {
  return runAction(async () => {
    const user = await requirePermission("consultas.responder");
    await assertLeadAccess(user, leadId);

    const draft = await generateDraft(leadId, { style });
    if (!draft) throw errors.noEncontrado("la consulta");

    revalidatePath(`/consultas/${leadId}`);
    return { body: draft.body, warning: draft.warning };
  });
}

/// "Más breve" / "Más formal" sobre el texto que está escrito en pantalla.
export async function rewriteDraftAction(
  text: string,
  style: "brief" | "formal",
): Promise<ActionResult<{ text: string }>> {
  return runAction(async () => {
    await requirePermission("consultas.responder");
    if (!text.trim()) throw errors.validacion("No hay texto para reescribir.");
    return { text: await rewriteText(text, style, storeConfig.name) };
  });
}

export async function generateDigestAction(): Promise<ActionResult<DigestRunResult>> {
  return runAction(async () => {
    const result = await runDigestAsAdmin();
    revalidatePath("/seguimiento/avisos");
    return result;
  });
}

/**
 * Simulador de mensajes entrantes (solo administración): entra por el mismo
 * camino que uno real, sin necesidad de cuentas de WhatsApp.
 */
export async function simulateInboundAction(input: unknown): Promise<ActionResult<{ leadId: string }>> {
  return runAction(async () => {
    await requirePermission("consultas.gestionar");
    const data = parseOrThrow(simulatorSchema, input);

    const result = await ingestInbound({
      channel: data.channel,
      fullName: data.fullName,
      phone: data.phone,
      body: data.body,
      externalId: data.channel === "WHATSAPP" ? `sim-${crypto.randomUUID()}` : undefined,
    });

    if (result.status === "invalid") throw errors.validacion(result.error);
    if (result.status === "duplicate-event") throw errors.conflicto("Ese mensaje ya se había procesado.");

    await generateDraft(result.leadId);
    revalidateLeads(result.leadId);
    return { leadId: result.leadId };
  });
}
