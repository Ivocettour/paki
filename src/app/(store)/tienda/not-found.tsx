import Link from "next/link";
import { Container } from "@/components/store/store-ui";

/// Se muestra cuando el equipo ya se vendió o el enlace no existe.
export default function TiendaNotFound() {
  return (
    <Container narrow className="py-24 text-center">
      <h1 className="text-[40px] font-semibold leading-tight tracking-[-0.035em] text-fg sm:text-[56px]">
        Este equipo ya no está disponible.
      </h1>
      <p className="mx-auto mt-3 max-w-[520px] text-[19px] text-fg-secondary">
        Puede que se haya vendido, o que el enlace no sea correcto. Mirá lo que tenemos ahora.
      </p>
      <Link
        href="/tienda/catalogo"
        className="mt-8 inline-flex h-12 items-center rounded-full bg-accent px-7 text-[17px] text-white transition-colors hover:bg-accent-hover"
      >
        Ver el catálogo
      </Link>
    </Container>
  );
}
