import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { SimulatorForm } from "./simulator-form";

export const metadata = { title: "Simular un mensaje" };

export default async function SimuladorPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "consultas.gestionar")) redirect("/consultas");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/consultas" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Volver a consultas
      </Link>

      <PageHeader
        title="Simular un mensaje"
        description="Entra por el mismo camino que uno real. Sirve para probar la bandeja sin cuentas de WhatsApp."
      />

      <Card>
        <CardHeader title="Mensaje entrante" />
        <CardBody>
          <SimulatorForm />
        </CardBody>
      </Card>
    </div>
  );
}
