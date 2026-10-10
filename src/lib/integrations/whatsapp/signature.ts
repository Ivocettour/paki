import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Meta firma el cuerpo de cada aviso con el "App Secret" de la aplicación:
 * `X-Hub-Signature-256: sha256=<HMAC-SHA256 del cuerpo exacto, en hexadecimal>`.
 * Hay que verificarlo sobre el texto crudo, antes de interpretar el JSON.
 */
export function signMetaBody(appSecret: string, rawBody: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}

export function verifyMetaSignature(input: {
  appSecret: string;
  header: string | null;
  rawBody: string;
}): boolean {
  const { appSecret, header, rawBody } = input;
  if (!appSecret || !header || !header.startsWith("sha256=")) return false;

  const expected = Buffer.from(signMetaBody(appSecret, rawBody).slice("sha256=".length), "hex");
  const given = Buffer.from(header.slice("sha256=".length), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Verificación inicial del webhook: Meta hace un GET con hub.mode=subscribe,
 * hub.verify_token y hub.challenge. Si el token coincide hay que responder el
 * challenge tal cual; si no, rechazar.
 */
export function answerChallenge(params: URLSearchParams, expectedToken: string): string | null {
  if (!expectedToken) return null;
  if (params.get("hub.mode") !== "subscribe") return null;

  const given = Buffer.from(params.get("hub.verify_token") ?? "");
  const expected = Buffer.from(expectedToken);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return params.get("hub.challenge");
}
