import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/card";
import { NewContactForm } from "./new-contact-form";

export const metadata = { title: "Cargar contacto" };

export default async function NuevoContactoPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "consultas.responder")) redirect("/consultas");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Cargar contacto"
        description="Para una recomendación, alguien que pasó por el local o un cliente anterior. Si ya existe, te avisamos."
      />
      <NewContactForm />
    </div>
  );
}
