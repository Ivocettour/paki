import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Registro inexistente dentro de la aplicación.
 *
 * Lo alcanzan las fichas que llaman a `notFound()`: un equipo, una venta, un
 * cliente o una compra cuyo id no existe.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
      <span className="mb-5 grid size-12 place-items-center rounded-full bg-surface-subtle">
        <SearchX className="size-5 text-fg-tertiary" aria-hidden />
      </span>

      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">
        No encontramos lo que buscabas
      </h1>

      <p className="mt-2.5 text-[15px] text-fg-secondary">
        El registro no existe o fue dado de baja. Puede que el enlace esté
        desactualizado.
      </p>

      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Link href="/inventario">
          <Button variant="secondary">Ir al inventario</Button>
        </Link>
        <Link href="/">
          <Button>Ir al dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
