import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { errors } from "@/lib/errors";
import { normalizePhone } from "@/lib/domain/phone";
import { assertLeadAccess } from "./access";
import { ingestInbound } from "./ingest";

export interface IncomingInput {
  /// Si ya existe la consulta, el mensaje se agrega a ella.
  leadId?: string;
  /// Si no, se identifica a la persona por su teléfono.
  phone?: string;
  fullName?: string;
  body: string;
}

/**
 * Anota un mensaje que un cliente le mandó a quien atiende POR FUERA del
 * sistema (al WhatsApp personal, por ejemplo), para que aparezca en la bandeja
 * y entre en el seguimiento como cualquier otra consulta.
 *
 * Entra por el mismo camino que los canales automáticos: unifica a la persona
 * por teléfono o correo, deja el mensaje como pendiente de respuesta y permite
 * generar el borrador. No envía nada.
 */
export async function recordIncomingMessage(
  input: IncomingInput,
): Promise<{ leadId: string; created: boolean }> {
  const user = await requirePermission("consultas.responder");

  const body = input.body.trim();
  if (!body) throw errors.validacion("Pegá o escribí el mensaje que te mandaron.");

  let phone: string | undefined;
  let email: string | undefined;
  let fullName = input.fullName?.trim() ?? "";

  if (input.leadId) {
    await assertLeadAccess(user, input.leadId);
    const lead = await prisma.lead.findUnique({
      where: { id: input.leadId },
      select: { fullName: true, phone: true, email: true },
    });
    if (!lead) throw errors.noEncontrado("la consulta");
    phone = lead.phone ?? undefined;
    email = lead.email ?? undefined;
    fullName = lead.fullName;
  } else {
    const normalized = normalizePhone(input.phone);
    if (!normalized) throw errors.validacion("El teléfono no parece válido.", { phone: ["El teléfono no parece válido."] });
    phone = normalized;
    if (!fullName) fullName = `WhatsApp ${normalized}`;

    // Si esa persona ya es una consulta de otro vendedor, no se le agrega el
    // mensaje a escondidas: el vendedor no la vería.
    const existing = await prisma.lead.findFirst({
      where: { phone: normalized },
      select: { id: true, assigneeId: true, fullName: true },
    });
    if (existing && !can(user.role, "consultas.ver_todas") && existing.assigneeId !== user.id) {
      throw errors.conflicto(
        `Ese teléfono ya es una consulta de otra persona del equipo (${existing.fullName}). Pedile a un administrador que te la asigne.`,
      );
    }
  }

  const result = await ingestInbound(
    { channel: "WHATSAPP", fullName, phone, email, body },
    // El vendedor que anota un mensaje nuevo se queda con la consulta.
    { assigneeId: user.role === "VENDEDOR" ? user.id : null },
  );

  if (result.status === "invalid") throw errors.validacion(result.error);
  if (result.status === "duplicate-event") throw errors.conflicto("Ese mensaje ya estaba cargado.");

  return { leadId: result.leadId, created: result.created };
}
