import Link from "next/link";

/// 404 fuera de la aplicación: una URL que no corresponde a ninguna sección.
/// No usa el shell porque puede alcanzarse sin sesión.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-surface-subtle px-6 text-center">
      <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-fg-tertiary">
        Error 404
      </p>

      <h1 className="mt-3 text-display text-fg">Página no encontrada</h1>

      <p className="mt-3 max-w-md text-[17px] text-fg-secondary">
        La dirección que ingresaste no existe en el sistema.
      </p>

      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center rounded-full bg-accent px-7 text-[15px] font-medium text-white transition-colors hover:bg-accent-hover"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
