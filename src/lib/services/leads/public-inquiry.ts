import { storeInquirySchema } from "@/lib/validations/leads";
import { errors } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { ingestInbound } from "./ingest";

/**
 * Consulta que hace un cliente desde la tienda. No exige sesión, así que es el
 * punto más expuesto de todo el módulo:
 *   · se valida todo con el mismo esquema que el formulario;
 *   · hay un campo trampa contra programas;
 *   · se limita cuántas consultas puede mandar una misma dirección.
 *
 * El límite vive en memoria: con varias instancias cada una cuenta por su lado.
 * Frena el abuso casual, no un ataque distribuido (eso es tarea del proveedor).
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const hits = new Map<string, number[]>();

export function isRateLimited(key: string, now: number = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  hits.set(key, [...recent, now]);

  // Evita que el mapa crezca sin límite con direcciones que no vuelven.
  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

/// Solo para tests.
export function resetRateLimit(): void {
  hits.clear();
}

export async function submitStoreInquiry(
  raw: unknown,
  clientKey: string,
): Promise<{ leadId: string | null }> {
  const parsed = storeInquirySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      (fieldErrors[field] ??= []).push(issue.message);
    }
    throw errors.validacion("Revisá los datos ingresados.", fieldErrors);
  }
  const input = parsed.data;

  // El campo trampa: si vino completo, es un programa. Se responde "ok" sin
  // guardar nada, para no darle pistas.
  if (input.website) return { leadId: null };

  if (isRateLimited(clientKey)) {
    throw errors.regla("Mandaste varias consultas seguidas. Esperá unos minutos y volvé a intentar.");
  }

  // Si consulta por un equipo, se menciona en el mensaje para que quien lea la
  // bandeja vea de cuál se trata aunque el equipo se venda después.
  let body = input.message;
  if (input.deviceId) {
    const device = await prisma.device.findUnique({
      where: { id: input.deviceId },
      select: { model: { select: { name: true, brand: { select: { name: true } } } } },
    });
    if (device) body = `[Consulta por ${device.model.brand.name} ${device.model.name}] ${input.message}`;
  }

  const result = await ingestInbound({
    channel: "WEB",
    fullName: input.fullName,
    phone: input.phone,
    email: input.email,
    deviceId: input.deviceId,
    body,
  });

  if (result.status === "invalid") throw errors.validacion(result.error);
  if (result.status === "duplicate-event") return { leadId: null };
  return { leadId: result.leadId };
}
