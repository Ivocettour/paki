import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { IncomingForm } from "./incoming-form";

export const metadata = { title: "Anotar mensaje recibido" };

export default async function MensajeRecibidoPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "consultas.responder")) redirect("/consultas");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/consultas" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Volver a consultas
      </Link>

      <PageHeader
        title="Anotar mensaje recibido"
        description="Alguien te escribió a tu WhatsApp personal: anotalo acá y queda en la bandeja y en el seguimiento."
      />

      <Card>
        <CardBody>
          <IncomingForm />
        </CardBody>
      </Card>
    </div>
  );
}
