"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { deletePhotoAction, setMainPhotoAction, setUseModelImageAction } from "@/lib/actions/device-photos";
import { shrinkImage } from "@/lib/client/shrink-image";
import { MAX_PHOTOS_PER_DEVICE } from "@/lib/domain/images";
import { Button } from "@/components/ui/button";

export function PhotoManager({
  deviceId,
  photos,
  canEdit,
  modelImageId,
  useModelImage,
}: {
  deviceId: string;
  photos: Array<{ id: string }>;
  canEdit: boolean;
  /// Imagen del modelo (cargada en Configuración), si existe.
  modelImageId: string | null;
  useModelImage: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const room = MAX_PHOTOS_PER_DEVICE - photos.length;

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const chosen = [...files].slice(0, Math.max(room, 0));
    if (files.length > chosen.length) {
      toast.warning(`Solo entran ${MAX_PHOTOS_PER_DEVICE} fotos por equipo.`);
    }

    setUploading(true);
    let uploaded = 0;

    for (const file of chosen) {
      try {
        const blob = await shrinkImage(file);
        const form = new FormData();
        form.append("foto", blob, "foto.jpg");

        const response = await fetch(`/api/inventario/${deviceId}/fotos`, { method: "POST", body: form });
        const result = (await response.json().catch(() => null)) as { ok: boolean; error?: string } | null;

        if (!response.ok || !result?.ok) {
          toast.error(result?.error ?? `No se pudo subir ${file.name}.`);
          continue;
        }
        uploaded++;
      } catch {
        toast.error(`No se pudo procesar ${file.name}. ¿Es una imagen?`);
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";

    if (uploaded > 0) {
      toast.success(uploaded === 1 ? "Foto subida" : `${uploaded} fotos subidas`);
      router.refresh();
    }
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deletePhotoAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Foto eliminada");
      router.refresh();
    });
  }

  function toggleModelImage(value: boolean) {
    startTransition(async () => {
      const result = await setUseModelImageAction(deviceId, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function makeMain(id: string) {
    startTransition(async () => {
      const result = await setMainPhotoAction(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {photos.length === 0 ? (
        <p className="rounded-[12px] border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-tertiary">
          Este equipo todavía no tiene fotos. En la tienda se muestra un dibujo con su color.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-[14px] border border-line-subtle bg-surface-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element -- la foto sale de nuestra propia API */}
              <img
                src={`/api/fotos/${photo.id}`}
                alt={`Foto ${index + 1} del equipo`}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              {index === 0 ? (
                <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
                  Principal
                </span>
              ) : null}

              {canEdit ? (
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2">
                  {index !== 0 ? (
                    <button
                      type="button"
                      onClick={() => makeMain(photo.id)}
                      disabled={isPending}
                      aria-label="Usar como foto principal"
                      title="Usar como principal"
                      className="grid size-8 place-items-center rounded-full bg-white/90 text-fg hover:bg-white"
                    >
                      <Star className="size-4" aria-hidden />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => remove(photo.id)}
                    disabled={isPending}
                    aria-label="Eliminar foto"
                    title="Eliminar"
                    className="grid size-8 place-items-center rounded-full bg-white/90 text-danger hover:bg-white"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            id="device-photos"
            onChange={(event) => onFiles(event.target.files)}
            disabled={uploading || room <= 0}
          />
          <Button
            type="button"
            variant="secondary"
            loading={uploading}
            disabled={room <= 0}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden />
            Subir fotos
          </Button>
          <p className="text-[12px] text-fg-tertiary">
            {room > 0
              ? `JPG, PNG o WebP. Se reducen solas. Podés subir ${room} más (máximo ${MAX_PHOTOS_PER_DEVICE}).`
              : `Llegaste al máximo de ${MAX_PHOTOS_PER_DEVICE} fotos.`}
          </p>
        </div>
      ) : null}

      <div className="rounded-[14px] border border-line-subtle p-4">
        <p className="text-[13px] font-medium text-fg">Mientras no tenga fotos propias</p>
        {modelImageId ? (
          <div className="mt-3 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagen de nuestra propia API */}
            <img
              src={`/api/fotos/modelo/${modelImageId}`}
              alt="Imagen del modelo"
              className="size-20 rounded-[12px] border border-line-subtle bg-surface-subtle object-contain"
            />
            <label className="flex items-start gap-2.5 text-[13px] text-fg-secondary">
              <input
                type="checkbox"
                checked={useModelImage}
                disabled={!canEdit || isPending}
                onChange={(event) => toggleModelImage(event.target.checked)}
                className="mt-0.5 size-4 rounded border-line accent-[var(--accent)]"
              />
              <span>
                Mostrar la imagen del modelo en la tienda.
                <span className="block text-fg-tertiary">
                  Si la desmarcás, se muestra el dibujo con el color del equipo.
                </span>
              </span>
            </label>
          </div>
        ) : (
          <p className="mt-1 text-[13px] text-fg-tertiary">
            Se muestra el dibujo con el color del equipo. Para usar una imagen del modelo, cargala en
            Configuración → catálogo.
          </p>
        )}
      </div>
    </div>
  );
}
