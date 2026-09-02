import { redirect } from "next/navigation";
import { getCatalog } from "@/lib/services/devices";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/card";
import { DeviceForm } from "../device-form";

export const metadata = { title: "Registrar equipo" };

export default async function NuevoEquipoPage() {
  const user = await getCurrentUser();
  // Barrera de servidor: no alcanza con ocultar el botón en el listado.
  if (!can(user?.role, "inventario.crear")) redirect("/inventario");

  const catalog = await getCatalog();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Registrar equipo"
        description="Cada equipo se carga como una unidad individual con su propio IMEI."
      />
      <DeviceForm
        catalog={catalog}
        mode="create"
        canEditPrice={can(user?.role, "inventario.editar_precio")}
        canSeePurchasePrice={can(user?.role, "inventario.ver_precio_compra")}
        canManageCatalog={can(user?.role, "catalogo.gestionar")}
      />
    </div>
  );
}
