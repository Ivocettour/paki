import { timingSafeEqual } from "node:crypto";

/// Verifica el "Authorization: Bearer <CRON_SECRET>" de los programadores. Sin
/// CRON_SECRET (16+ caracteres) todo queda cerrado.
export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;

  const given = Buffer.from((request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
