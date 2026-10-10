/**
 * Validación de imágenes subidas. No se confía en el tipo que declara el
 * navegador ni en la extensión: se mira el contenido real (firma del archivo).
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type ImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/// El navegador reduce cada foto antes de subirla; esto es la barrera del servidor.
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_PHOTOS_PER_DEVICE = 8;

/// Tipo real de la imagen según sus primeros bytes, o null si no es una imagen permitida.
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";

  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, i) => bytes[i] === byte)) return "image/png";

  // WebP: "RIFF" + tamaño + "WEBP"
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";

  return null;
}
