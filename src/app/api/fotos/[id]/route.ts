import { prisma } from "@/lib/db";

/**
 * Sirve la imagen de una foto de equipo. Es pública (la ve cualquiera que mire
 * la tienda), pero solo entrega imágenes: el id no es adivinable y nunca se
 * expone nada más de la fila.
 *
 * El contenido de una foto no cambia nunca (al reemplazarla se crea otra con
 * otro id), por eso se puede cachear para siempre.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const photo = await prisma.devicePhoto.findUnique({
    where: { id },
    select: { data: true, contentType: true },
  });
  if (!photo) return new Response("No encontrada", { status: 404 });

  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      // El navegador no debe "adivinar" otro tipo de contenido.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
