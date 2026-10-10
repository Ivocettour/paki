import { after } from "next/server";
import { generateDraft } from "@/lib/services/leads/draft";
import { handleWhatsAppEvents, logWebhook } from "@/lib/services/leads/channels";
import { metaAppSecret, whatsappVerifyToken } from "@/lib/integrations/whatsapp/client";
import { answerChallenge, verifyMetaSignature } from "@/lib/integrations/whatsapp/signature";
import { parseWhatsAppPayload } from "@/lib/integrations/whatsapp/payload";

/// Verificación inicial que hace Meta al configurar el webhook: responde el
/// challenge si el token coincide.
export async function GET(request: Request) {
  const challenge = answerChallenge(new URL(request.url).searchParams, whatsappVerifyToken());
  if (challenge === null) return new Response("Token de verificación incorrecto", { status: 403 });
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/**
 * Mensajes y estados de la WhatsApp Cloud API. Se verifica la firma sobre el
 * cuerpo crudo, se procesa y se responde 200 enseguida (Meta reintenta si tarda
 * o falla). Los borradores de la IA se preparan después de responder.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const valid = verifyMetaSignature({
    appSecret: metaAppSecret(),
    header: request.headers.get("x-hub-signature-256"),
    rawBody,
  });
  if (!valid) {
    await logWebhook({
      source: "whatsapp",
      signatureOk: false,
      outcome: "rejected",
      detail: "Firma inválida o ausente",
    });
    return new Response("Firma inválida", { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    await logWebhook({ source: "whatsapp", signatureOk: true, outcome: "error", detail: "El cuerpo no es JSON" });
    return new Response("JSON inválido", { status: 400 });
  }

  const parsed = parseWhatsAppPayload(json);
  if (parsed.messages.length === 0 && parsed.statuses.length === 0) {
    await logWebhook({
      source: "whatsapp",
      signatureOk: true,
      kind: "other",
      outcome: "ignored",
      detail: `Sin mensajes ni estados (${parsed.ignored} ignorados)`,
    });
    return Response.json({ received: 0 });
  }

  const summary = await handleWhatsAppEvents(parsed);

  after(async () => {
    for (const leadId of summary.leadIds) {
      try {
        await generateDraft(leadId);
      } catch (error) {
        console.error("[whatsapp] No se pudo preparar el borrador:", error);
      }
    }
  });

  return Response.json({
    received: summary.received,
    duplicates: summary.duplicates,
    failed: summary.failed,
  });
}
