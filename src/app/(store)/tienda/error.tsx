"use client";

import { Container } from "@/components/store/store-ui";

/// Error inesperado en la tienda. No se muestra el detalle técnico.
export default function TiendaError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container narrow className="py-24 text-center">
      <h1 className="text-[40px] font-semibold leading-tight tracking-[-0.035em] text-fg sm:text-[56px]">
        Algo salió mal.
      </h1>
      <p className="mx-auto mt-3 max-w-[520px] text-[19px] text-fg-secondary">
        No pudimos cargar esta página. Probá de nuevo en unos segundos.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex h-12 items-center rounded-full bg-accent px-7 text-[17px] text-white transition-colors hover:bg-accent-hover"
      >
        Reintentar
      </button>
    </Container>
  );
}
