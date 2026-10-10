import type { Metadata } from "next";
import { storeConfig } from "@/lib/store-config";
import { LEGAL_UPDATED, LegalPage } from "@/components/store/legal-page";

export const metadata: Metadata = {
  title: "Eliminación de datos",
  description: `Cómo pedirle a ${storeConfig.name} que elimine tus datos personales.`,
};

export default function EliminarDatosPage() {
  const name = storeConfig.name;
  const whatsapp = storeConfig.whatsapp;

  return (
    <LegalPage title="Eliminación de datos" updated={LEGAL_UPDATED}>
      <p>
        Si nos consultaste por la tienda o por WhatsApp y querés que borremos tus datos, podés pedirlo
        en cualquier momento y sin dar explicaciones.
      </p>

      <h2>Cómo pedirlo</h2>
      <ol className="list-decimal space-y-2 pl-6">
        <li>
          Escribinos
          {whatsapp ? (
            <>
              {" "}
              por WhatsApp al{" "}
              <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hola, quiero que eliminen mis datos personales.")}`} className="text-accent hover:underline">
                +{whatsapp}
              </a>
            </>
          ) : (
            " por los medios que figuran en la tienda"
          )}{" "}
          con el mensaje <strong>“Quiero que eliminen mis datos”</strong>, desde el mismo número o
          correo con el que nos consultaste.
        </li>
        <li>Te pedimos que nos confirmes tu nombre para encontrar tu consulta.</li>
        <li>
          Eliminamos tus datos de nuestro sistema y te avisamos cuando esté hecho, dentro de los{" "}
          <strong>30 días</strong> de tu pedido.
        </li>
      </ol>

      <h2>Qué eliminamos</h2>
      <ul>
        <li>Tu nombre, teléfono y correo.</li>
        <li>El historial de mensajes de tu consulta y las notas internas sobre ella.</li>
      </ul>
      <p>
        Podemos conservar lo que la ley nos obliga a guardar (por ejemplo, el comprobante de una venta
        ya realizada).
      </p>

      <h2>WhatsApp</h2>
      <p>
        Los mensajes que intercambiaste también quedan en tu propio WhatsApp y en la plataforma de
        Meta. Para borrarlos de ahí tenés que eliminarlos vos desde la app o seguir las instrucciones
        de Meta; nosotros solo podemos borrar lo que guardamos en nuestro sistema.
      </p>

      <p>
        Más información sobre qué datos tratamos en nuestra{" "}
        <a href="/tienda/privacidad" className="text-accent hover:underline">
          política de privacidad
        </a>
        .
      </p>
      <p className="text-[14px] text-fg-tertiary">{name}</p>
    </LegalPage>
  );
}
