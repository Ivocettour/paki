import { prisma } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { errors } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Quién puede ver y tocar cada consulta.
 *
 * El administrador ve todas. El vendedor solo las que le asignaron: una consulta
 * sin responsable, o de otro vendedor, no existe para él. Se valida SIEMPRE en
 * el servidor; ocultar el enlace en la pantalla no alcanza.
 */
export function visibleLeadsWhere(user: Pick<SessionUser, "id" | "role">): { assigneeId?: string } {
  return can(user.role, "consultas.ver_todas") ? {} : { assigneeId: user.id };
}

/// Lanza "no encontrada" si la consulta no existe o el usuario no tiene acceso
/// (no se distingue, para no revelar que existe).
export async function assertLeadAccess(
  user: Pick<SessionUser, "id" | "role">,
  leadId: string,
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, ...visibleLeadsWhere(user) },
    select: { id: true },
  });
  if (!lead) throw errors.noEncontrado("la consulta");
}
