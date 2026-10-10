/**
 * Normaliza teléfonos argentinos al formato internacional de WhatsApp:
 * +549 + código de área + número (10 dígitos). Sirve para unificar a la misma
 * persona cuando escribe por distintos canales. Los números de otros países se
 * conservan como +dígitos. Si no se puede interpretar, devuelve null.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);
  const hadPlus = trimmed.startsWith("+") || trimmed.startsWith("00");

  // Número de otro país escrito con prefijo internacional: se deja como viene.
  if (hadPlus && !digits.startsWith("54")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  if (digits.startsWith("54")) digits = digits.slice(2);
  if (digits.startsWith("9") && digits.length === 11) digits = digits.slice(1); // el 9 de móvil
  if (digits.startsWith("0")) digits = digits.slice(1); // prefijo de discado nacional

  // "362 15 4123456": el 15 de celular va después del código de área (2 a 4 dígitos).
  if (digits.length === 12) {
    for (const area of [2, 3, 4]) {
      if (digits.slice(area, area + 2) === "15") {
        digits = digits.slice(0, area) + digits.slice(area + 2);
        break;
      }
    }
  }

  return digits.length === 10 ? `+549${digits}` : null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/// Primer nombre, para saludar y firmar.
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
