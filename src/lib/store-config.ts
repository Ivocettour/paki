/**
 * Datos del local que se muestran en la tienda pública.
 *
 * Se configuran por variables de entorno (ver `.env.example`) para no tocar
 * código al cambiar el teléfono o el horario. Todas son opcionales: lo que no
 * esté definido simplemente no se muestra.
 */

const digitsOnly = (value: string | undefined) => (value ?? "").replace(/\D/g, "");

export const storeConfig = {
  name: process.env.NEXT_PUBLIC_STORE_NAME?.trim() || "Paki",
  /// Con código de país y sin signos, por ejemplo 5491123456789.
  whatsapp: digitsOnly(process.env.NEXT_PUBLIC_STORE_WHATSAPP),
  address: process.env.NEXT_PUBLIC_STORE_ADDRESS?.trim() || "",
  hours: process.env.NEXT_PUBLIC_STORE_HOURS?.trim() || "",
  instagram: process.env.NEXT_PUBLIC_STORE_INSTAGRAM?.trim().replace(/^@/, "") || "",
};

/// Enlace de WhatsApp con el mensaje ya escrito, o `null` si no hay número.
export function whatsappLink(message: string): string | null {
  if (!storeConfig.whatsapp) return null;
  return `https://wa.me/${storeConfig.whatsapp}?text=${encodeURIComponent(message)}`;
}

export const STORE_BASE_PATH = "/tienda";
