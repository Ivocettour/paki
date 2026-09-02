import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupplierOptions } from "@/lib/services/suppliers";
import { getAccessoryOptions } from "@/lib/services/purchases";
import { getCatalog } from "@/lib/services/devices";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PurchaseForm } from "./purchase-form";

export const metadata = { title: "Registrar compra" };

export default async function NuevaCompraPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "compras.gestionar")) redirect("/compras");

  const [suppliers, catalog, accessories] = await Promise.all([
    getSupplierOptions(),
    getCatalog(),
    getAccessoryOptions(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Registrar compra"
        description="Se guarda en borrador. La mercadería ingresa recién al confirmarla."
      />

      {suppliers.length === 0 ? (
        <Card>
          <CardBody className="space-y-4 text-center">
            <p className="text-[15px] font-medium text-fg">
              Primero cargá un proveedor
            </p>
            <p className="text-[14px] text-fg-secondary">
              Una compra siempre se le hace a alguien. Creá al menos un proveedor para
              poder registrarla.
            </p>
            <div className="flex justify-center pt-1">
              <Link href="/proveedores">
                <Button>Ir a proveedores</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <PurchaseForm
          suppliers={suppliers}
          catalog={catalog}
          accessories={accessories}
        />
      )}
    </div>
  );
}
