import { setModelImage } from "@/lib/services/device-photos";
import { toUserMessage } from "@/lib/errors";
import { MAX_PHOTO_BYTES } from "@/lib/domain/images";

/// Sube la imagen de un modelo (multipart, campo "foto"). Exige permiso de
/// gestión del catálogo; lo valida el servicio.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_PHOTO_BYTES + 64 * 1024) {
    return Response.json({ ok: false, error: "La imagen es demasiado pesada (máximo 3 MB)." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get("foto");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "No llegó ninguna imagen." }, { status: 400 });
    }

    const image = await setModelImage(id, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ ok: true, id: image.id });
  } catch (error) {
    const { message } = toUserMessage(error);
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 500;
    return Response.json({ ok: false, error: message }, { status });
  }
}
