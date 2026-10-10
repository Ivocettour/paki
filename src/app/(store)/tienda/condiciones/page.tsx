import type { Metadata } from "next";
import { storeConfig } from "@/lib/store-config";
import { LEGAL_UPDATED, LegalPage } from "@/components/store/legal-page";

export const metadata: Metadata = {
  title: "Condiciones del servicio",
  description: `Condiciones de uso de la tienda de ${storeConfig.name}.`,
};

export default function CondicionesPage() {
  const name = storeConfig.name;

  return (
    <LegalPage title="Condiciones del servicio" updated={LEGAL_UPDATED}>
      <p>
        Al usar la tienda de <strong>{name}</strong> aceptás estas condiciones. Si no estás de
        acuerdo, no uses el sitio.
      </p>

      <h2>Qué es esta tienda</h2>
      <p>
        Es un catálogo de los equipos y accesorios que tenemos en el local. Sirve para ver precios,
        estado y disponibilidad, y para consultarnos. <strong>No se compra en el sitio</strong>: la
        operación se concreta con nuestro equipo.
      </p>

      <h2>Equipos y precios</h2>
      <ul>
        <li>Cada equipo es una unidad única. Si se vende, deja de aparecer en la tienda.</li>
        <li>
          Los precios y la disponibilidad pueden cambiar sin aviso. Un equipo que figura en la tienda
          no queda reservado hasta que lo confirmemos con vos.
        </li>
        <li>
          Indicamos el estado de cada equipo (nuevo sellado, nuevo sin sellar o usado) y, en los
          usados, la batería. Las fotos y los dibujos son ilustrativos.
        </li>
        <li>
          El valor de las cuotas es una referencia calculada con los planes vigentes; las condiciones
          finales se confirman al momento de la compra.
        </li>
      </ul>

      <h2>Tus consultas</h2>
      <p>
        Al enviarnos una consulta o escribirnos por WhatsApp aceptás que te respondamos por ese medio.
        Tenés que darnos datos verdaderos y no usar el formulario para enviar spam o contenido
        ilegal. Podemos bloquear envíos que parezcan abusivos.
      </p>

      <h2>Responsabilidad</h2>
      <p>
        Hacemos lo posible para que la información sea correcta, pero puede haber errores o demoras
        en la actualización. {name} no se responsabiliza por decisiones tomadas solo con la
        información del sitio sin confirmarla con nosotros.
      </p>

      <h2>Datos personales</h2>
      <p>
        Tratamos tus datos como explicamos en la{" "}
        <a href="/tienda/privacidad" className="text-accent hover:underline">
          política de privacidad
        </a>
        .
      </p>

      <h2>Cambios</h2>
      <p>
        Podemos modificar estas condiciones. La fecha de arriba indica la última versión; seguir
        usando el sitio implica aceptar los cambios.
      </p>

      <h2>Contacto</h2>
      <p>
        {storeConfig.whatsapp ? (
          <>
            Escribinos por WhatsApp al{" "}
            <a href={`https://wa.me/${storeConfig.whatsapp}`} className="text-accent hover:underline">
              +{storeConfig.whatsapp}
            </a>
            .
          </>
        ) : (
          "Escribinos por los medios que figuran en la tienda."
        )}
      </p>
    </LegalPage>
  );
}
