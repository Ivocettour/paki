import { Container } from "./store-ui";

/// Estructura común de las páginas legales de la tienda.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <Container narrow className="py-12 sm:py-16">
      <h1 className="text-[36px] font-semibold leading-tight tracking-[-0.035em] text-fg sm:text-[48px]">
        {title}
      </h1>
      <p className="mt-2 text-[14px] text-fg-tertiary">Última actualización: {updated}</p>

      <div className="mt-8 space-y-5 text-[17px] leading-relaxed text-fg-secondary [&_h2]:mt-10 [&_h2]:text-[24px] [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-fg">
        {children}
      </div>
    </Container>
  );
}

/// Fecha de las páginas legales. Se actualiza a mano cuando cambia el texto.
export const LEGAL_UPDATED = "10 de octubre de 2026";
