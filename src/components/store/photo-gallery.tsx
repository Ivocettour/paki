"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Galería de la ficha del equipo: la foto grande y, si hay más de una, las
 * miniaturas para cambiar. Sin imágenes se muestra el dibujo (`fallback`).
 */
export function PhotoGallery({
  images,
  alt,
  fallback,
}: {
  images: string[];
  alt: string;
  fallback: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="grid h-[380px] place-items-center rounded-[28px] bg-surface-raised px-8 py-10 sm:h-[520px]">
        {fallback}
      </div>
    );
  }

  const current = images[Math.min(index, images.length - 1)];

  return (
    <div>
      <div className="grid h-[380px] place-items-center overflow-hidden rounded-[28px] bg-surface-raised p-6 sm:h-[520px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen de nuestra propia API */}
        <img src={current} alt={alt} className="max-h-full max-w-full object-contain" />
      </div>

      {images.length > 1 ? (
        <ul className="mt-3 flex gap-2.5 overflow-x-auto pb-1" aria-label="Fotos del equipo">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver la foto ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "size-[72px] overflow-hidden rounded-[14px] border-2 bg-surface-raised p-1",
                  i === index ? "border-accent" : "border-transparent hover:border-line",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen de nuestra propia API */}
                <img src={src} alt="" className="size-full object-contain" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
