import type { Metadata } from "next";
import { storeConfig } from "@/lib/store-config";
import { LEGAL_UPDATED, LegalPage } from "@/components/store/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: `Qué datos recopila ${storeConfig.name}, para qué los usa y cómo podés pedir que los borremos.`,
};

export default function PrivacidadPage() {
  const name = storeConfig.name;

  return (
    <LegalPage title="Política de privacidad" updated={LEGAL_UPDATED}>
      <p>
        <strong>{name}</strong> es un local de venta de celulares y accesorios. Esta política explica
        qué datos personales recopilamos cuando nos consultás por la tienda o por WhatsApp, para qué
        los usamos y qué derechos tenés sobre ellos.
      </p>

      <h2>Qué datos recopilamos</h2>
      <ul>
        <li>
          <strong>Datos que nos dejás vos:</strong> nombre, teléfono, correo electrónico (opcional) y
          el texto de tu consulta, cuando completás el formulario de la tienda.
        </li>
        <li>
          <strong>Mensajes de WhatsApp:</strong> si nos escribís por WhatsApp, recibimos tu número, el
          nombre de tu perfil y el contenido de los mensajes que intercambiamos.
        </li>
        <li>
          <strong>Datos técnicos mínimos</strong> necesarios para que el sitio funcione y para evitar
          el abuso del formulario (por ejemplo, tu dirección IP para limitar envíos repetidos). No la
          guardamos junto con tu consulta.
        </li>
      </ul>
      <p>No usamos cookies de publicidad ni de seguimiento en la tienda.</p>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Responder tu consulta y darte seguimiento sobre el equipo que te interesa.</li>
        <li>Coordinar la reserva, el pago o la visita al local.</li>
        <li>Recordarle a nuestro equipo cuándo volver a contactarte, si lo pedís o lo acordamos.</li>
      </ul>
      <p>
        No vendemos tus datos ni los compartimos con terceros para publicidad. Solo los ven las
        personas de {name} que atienden consultas.
      </p>

      <h2>Con quién se comparten</h2>
      <ul>
        <li>
          <strong>Meta (WhatsApp):</strong> si conversás con nosotros por WhatsApp, los mensajes
          pasan por la plataforma de WhatsApp Business de Meta, que los procesa según sus propias
          políticas.
        </li>
        <li>
          <strong>Proveedores de infraestructura</strong> que alojan el sitio y la base de datos, que
          los tratan solo para prestarnos ese servicio.
        </li>
        <li>
          <strong>Un servicio de inteligencia artificial</strong> que nos ayuda a redactar
          borradores de respuesta. Una persona de nuestro equipo los revisa y los envía; la IA nunca
          te escribe por su cuenta.
        </li>
      </ul>

      <h2>Cuánto tiempo los conservamos</h2>
      <p>
        Conservamos tus datos mientras dure la consulta y por un tiempo razonable después, para poder
        atenderte si volvés a escribirnos. Podés pedir que los borremos antes en cualquier momento.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Podés pedir acceder a tus datos, corregirlos o eliminarlos. Para eliminarlos seguí las
        instrucciones de la página{" "}
        <a href="/tienda/eliminar-datos" className="text-accent hover:underline">
          Eliminación de datos
        </a>
        . En Argentina, la Agencia de Acceso a la Información Pública es el órgano de control de la
        Ley 25.326 de protección de datos personales y atiende las denuncias por incumplimientos.
      </p>

      <h2>Contacto</h2>
      <p>
        Para cualquier consulta sobre esta política escribinos
        {storeConfig.whatsapp ? (
          <>
            {" "}
            por WhatsApp al{" "}
            <a href={`https://wa.me/${storeConfig.whatsapp}`} className="text-accent hover:underline">
              +{storeConfig.whatsapp}
            </a>
          </>
        ) : (
          " por los medios que figuran en la tienda"
        )}
        {storeConfig.address ? ` o acercate a ${storeConfig.address}` : ""}.
      </p>

      <p className="text-[14px] text-fg-tertiary">
        Podemos actualizar esta política. La fecha de arriba indica la última versión.
      </p>
    </LegalPage>
  );
}
