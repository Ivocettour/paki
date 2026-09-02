import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/card";
import { SaleForm } from "./sale-form";

export const metadata = { title: "Registrar venta" };

export default async function NuevaVentaPage() {
  const user = await getCurrentUser();
  // Barrera de servidor, además de ocultar el botón en el listado.
  if (!can(user?.role, "ventas.registrar")) redirect("/ventas");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Registrar venta"
        description="Los equipos pasan a Vendido y el stock se actualiza automáticamente."
      />
      <SaleForm />
    </div>
  );
}
