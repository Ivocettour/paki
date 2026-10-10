"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { deleteModelImageAction } from "@/lib/actions/device-photos";
import { shrinkImage } from "@/lib/client/shrink-image";

/// Imagen de un modelo: la usa la tienda mientras un equipo no tenga fotos
/// propias. Se sube una vez y vale para todos los equipos de ese modelo.
export function ModelImage({
  modelId,
  modelName,
  imageId,
  canManage,
}: {
  modelId: string;
  modelName: string;
  imageId: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const blob = await shrinkImage(file);
      const form = new FormData();
      form.append("foto", blob, "modelo.jpg");

      const response = await fetch(`/api/modelos/${modelId}/imagen`, { method: "POST", body: form });
      const result = (await response.json().catch(() => null)) as { ok: boolean; error?: string } | null;

      if (!response.ok || !result?.ok) {
        toast.error(result?.error ?? "No se pudo subir la imagen.");
      } else {
        toast.success("Imagen del modelo guardada");
        router.refresh();
      }
    } catch {
      toast.error("No se pudo procesar el archivo. ¿Es una imagen?");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteModelImageAction(modelId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Imagen quitada");
      router.refresh();
    });
  }

  const thumb = "size-10 shrink-0 rounded-[10px] border border-line-subtle bg-surface-subtle";

  return (
    <div className="flex items-center gap-1.5">
      {imageId ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen de nuestra propia API
        <img src={`/api/fotos/modelo/${imageId}`} alt={`Imagen de ${modelName}`} className={thumb + " object-contain"} />
      ) : (
        <span className={thumb + " grid place-items-center text-fg-tertiary"} aria-hidden>
          <ImagePlus className="size-4" />
        </span>
      )}

      {canManage ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-label={`Imagen de ${modelName}`}
            onChange={(event) => onFile(event.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading || isPending}
            className="rounded-full px-2.5 py-1 text-[12px] font-medium text-accent hover:bg-accent-soft disabled:opacity-50"
          >
            {uploading ? "Subiendo…" : imageId ? "Cambiar" : "Subir imagen"}
          </button>
          {imageId ? (
            <button
              type="button"
              onClick={remove}
              disabled={uploading || isPending}
              aria-label={`Quitar la imagen de ${modelName}`}
              className="grid size-7 place-items-center rounded-full text-fg-tertiary hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
