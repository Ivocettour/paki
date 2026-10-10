import { addDevicePhoto } from "@/lib/services/device-photos";
import { toUserMessage } from "@/lib/errors";
import { MAX_PHOTO_BYTES } from "@/lib/domain/images";

/**
 * Sube una foto de un equipo (multipart, campo "foto"). Exige sesión con permiso
 * de edición de inventario: lo valida el servicio, no solo el proxy.
 *
 * Es una ruta y no una Server Action porque las acciones tienen un límite de
 * tamaño de cuerpo muy bajo para imágenes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Corte barato antes de leer el cuerpo entero.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_PHOTO_BYTES + 64 * 1024) {
    return Response.json({ ok: false, error: "La foto es demasiado pesada (máximo 3 MB)." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get("foto");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: "No llegó ninguna foto." }, { status: 400 });
    }

    const photo = await addDevicePhoto(id, new Uint8Array(await file.arrayBuffer()));
    return Response.json({ ok: true, id: photo.id });
  } catch (error) {
    const { message } = toUserMessage(error);
    const status = typeof (error as { status?: number }).status === "number" ? (error as { status: number }).status : 500;
    return Response.json({ ok: false, error: message }, { status });
  }
}
