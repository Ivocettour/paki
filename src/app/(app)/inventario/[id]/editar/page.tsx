import { notFound, redirect } from "next/navigation";
import { getCatalog, getDeviceDetail } from "@/lib/services/devices";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import { PageHeader } from "@/components/ui/card";
import { DeviceForm } from "../../device-form";

export const metadata = { title: "Editar equipo" };

export default async function EditarEquipoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!can(user?.role, "inventario.editar")) redirect(`/inventario/${id}`);

  let device;
  try {
    device = await getDeviceDetail(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NO_ENCONTRADO") notFound();
    throw error;
  }

  const catalog = await getCatalog();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Editar equipo"
        description={`${device.brandName} ${device.modelName}${
          device.imei ? ` · ${device.imei}` : ""
        }`}
      />
      <DeviceForm
        catalog={catalog}
        mode="edit"
        deviceId={device.id}
        canEditPrice={can(user?.role, "inventario.editar_precio")}
        canSeePurchasePrice={device.canSeePurchasePrice}
        defaultValues={{
          modelId: device.modelId,
          color: device.color,
          storageGb: device.storageGb ?? undefined,
          condition: device.condition,
          batteryPercent: device.batteryPercent,
          imei: device.imei ?? undefined,
          serialNumber: device.serialNumber ?? undefined,
          purchasePrice: device.purchasePrice,
          salePrice: device.salePrice,
          entryDate: device.entryDate,
          notes: device.notes ?? undefined,
          inventoryStatus: device.inventoryStatus,
          requiresImei: device.imei !== null,
        }}
      />
    </div>
  );
}
