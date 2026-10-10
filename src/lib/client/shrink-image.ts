/// Lado mayor de la imagen ya reducida. Alcanza para la tienda y pesa poco.
const MAX_SIDE = 1600;
const QUALITY = 0.85;

/**
 * Reduce una imagen en el navegador antes de subirla: una foto de celular pesa
 * varios MB y no hace falta esa resolución. Devuelve un JPEG.
 * Solo se usa del lado del cliente (necesita canvas).
 */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo procesar la imagen.");

  // Fondo blanco: un PNG con transparencia no debe quedar negro al pasar a JPEG.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen."))),
      "image/jpeg",
      QUALITY,
    ),
  );
}
