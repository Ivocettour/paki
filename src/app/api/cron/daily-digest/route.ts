import { cronAuthorized } from "@/lib/cron";
import { runDailyDigest } from "@/lib/services/leads/digest";

/**
 * Lo llama un programador externo todos los días (por ejemplo a las 8:00, hora
 * de Buenos Aires):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio/api/cron/daily-digest
 * Sin CRON_SECRET configurado el endpoint queda cerrado.
 */
async function handle(request: Request) {
  if (!cronAuthorized(request)) return new Response("No autorizado", { status: 401 });
  return Response.json(await runDailyDigest());
}

export const POST = handle;
// Algunos programadores (Vercel Cron) solo hacen GET.
export const GET = handle;
