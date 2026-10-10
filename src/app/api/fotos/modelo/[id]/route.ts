import { prisma } from "@/lib/db";

/// Sirve la imagen de un modelo. El id es el de la imagen (no el del modelo):
/// al reemplazarla cambia, por eso se puede cachear para siempre.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const image = await prisma.modelImage.findUnique({
    where: { id },
    select: { data: true, contentType: true },
  });
  if (!image) return new Response("No encontrada", { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
