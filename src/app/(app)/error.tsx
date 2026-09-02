"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error dentro de la aplicación.
 *
 * Nunca muestra el mensaje técnico: el detalle queda en el servidor y acá solo
 * se ofrece una salida. `digest` es el identificador que Next asigna al error
 * en producción, y sirve para localizarlo en los logs.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-de-pantalla]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
      <span className="mb-5 grid size-12 place-items-center rounded-full bg-danger-soft">
        <AlertTriangle className="size-5 text-danger" aria-hidden />
      </span>

      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">
        No se pudo cargar esta pantalla
      </h1>

      <p className="mt-2.5 text-[15px] text-fg-secondary">
        Hubo un problema al obtener la información. Puede ser algo momentáneo:
        probá de nuevo en unos instantes.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Button onClick={reset}>
          <RotateCcw className="size-4" aria-hidden />
          Reintentar
        </Button>
        <Link href="/">
          <Button variant="secondary">Ir al dashboard</Button>
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 text-[12px] text-fg-tertiary">
          Si el problema sigue, pasale este código a quien administre el sistema:{" "}
          <span className="tabular font-medium text-fg-secondary">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
