import Link from "next/link";
import { storeConfig, whatsappLink } from "@/lib/store-config";
import { Container } from "./store-ui";

/// Pie de página con el aspecto del de apple.com: gris, texto chico, columnas.
export function StoreFooter() {
  const whatsapp = whatsappLink(`Hola ${storeConfig.name}, quiero hacer una consulta.`);
  const year = new Date().getFullYear();

  const columns: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
    {
      title: "Comprar",
      links: [
        { href: "/tienda/catalogo?type=CELULAR", label: "Celulares" },
        { href: "/tienda/catalogo?type=TABLET", label: "Tablets" },
        { href: "/tienda/catalogo?type=RELOJ", label: "Relojes" },
        { href: "/tienda/accesorios", label: "Accesorios" },
      ],
    },
    {
      title: "Estado del equipo",
      links: [
        { href: "/tienda/catalogo?condition=NUEVO_SELLADO", label: "Nuevos sellados" },
        { href: "/tienda/catalogo?condition=NUEVO_SIN_SELLAR", label: "Nuevos sin sellar" },
        { href: "/tienda/catalogo?condition=USADO", label: "Usados" },
      ],
    },
  ];

  return (
    <footer className="bg-surface-subtle text-[12px] leading-[1.5] text-fg-secondary">
      <Container className="py-10">
        <div className="grid grid-cols-1 gap-10 border-b border-line pb-8 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="mb-3 text-[12px] font-semibold text-fg">{column.title}</h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-fg hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="sm:col-span-2">
            <h2 className="mb-3 text-[12px] font-semibold text-fg">Visitanos</h2>
            <address className="space-y-1.5 not-italic">
              <p className="text-[14px] font-semibold tracking-[-0.01em] text-fg">
                {storeConfig.name}
              </p>
              {storeConfig.address ? <p>{storeConfig.address}</p> : null}
              {storeConfig.hours ? <p>{storeConfig.hours}</p> : null}
              {whatsapp ? (
                <p>
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Escribinos por WhatsApp
                  </a>
                </p>
              ) : null}
              {storeConfig.instagram ? (
                <p>
                  <a
                    href={`https://instagram.com/${storeConfig.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    @{storeConfig.instagram}
                  </a>
                </p>
              ) : null}
              {!storeConfig.address && !storeConfig.hours && !whatsapp ? (
                <p>Consultá por nuestros equipos en el local.</p>
              ) : null}
            </address>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Los precios y la disponibilidad pueden cambiar sin aviso. Cada equipo es una unidad
            única: si se vende, deja de aparecer.
          </p>
          <p className="flex shrink-0 items-center gap-4">
            <span>© {year} {storeConfig.name}</span>
            <Link href="/login" className="hover:text-fg hover:underline">
              Acceso del personal
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}
