/**
 * Deja un texto de la IA listo para un mensaje de WhatsApp: sin etiquetas HTML
 * ni saltos de línea escritos como "\n". Los modelos a veces devuelven `<br>` o
 * `\n` literales aunque se les pida texto plano; el cliente no tiene que ver eso.
 */
export function cleanDraftText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
