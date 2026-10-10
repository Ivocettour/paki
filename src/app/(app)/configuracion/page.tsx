import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getCatalogOverview } from "@/lib/services/catalog";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listFinancingPlans } from "@/lib/services/financing";
import { BrandSection, NewBrandButton } from "./catalog-ui";
import { FinancingPlans } from "./financing-ui";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "configuracion.ver")) redirect("/");

  const [brands, financingPlans] = await Promise.all([
    getCatalogOverview(),
    listFinancingPlans(),
  ]);
  const canManage = can(user?.role, "catalogo.gestionar");

  const modelCount = brands.reduce((sum, brand) => sum + brand.models.length, 0);

  return (
    <>
      <PageHeader
        title="Configuración"
        description="Catálogo de marcas y modelos, y recargos por financiación en cuotas."
        action={canManage ? <NewBrandButton /> : null}
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[13px]">
          <span className="text-fg-secondary">
            <span className="tabular text-[17px] font-semibold text-fg">
              {brands.length}
            </span>{" "}
            {brands.length === 1 ? "marca" : "marcas"}
          </span>
          <span className="text-fg-secondary">
            <span className="tabular text-[17px] font-semibold text-fg">{modelCount}</span>{" "}
            {modelCount === 1 ? "modelo" : "modelos"}
          </span>
          <span className="text-fg-tertiary">
            El stock mínimo de cada modelo dispara la alerta del dashboard.
          </span>
        </CardBody>
      </Card>

      {brands.length === 0 ? (
        <Card>
          <EmptyState
            icon={Package}
            title="El catálogo está vacío"
            description="Cargá una marca y sus modelos para poder registrar equipos."
            action={canManage ? <NewBrandButton /> : null}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {brands.map((brand) => (
            <BrandSection key={brand.id} brand={brand} canManage={canManage} />
          ))}
        </div>
      )}

      <FinancingPlans plans={financingPlans} canManage={canManage} />

      <Card className="mt-6">
        <CardHeader title="Sobre las eliminaciones" />
        <CardBody className="space-y-2 text-[13px] text-fg-secondary">
          <p>
            Una marca o un modelo solo se pueden eliminar si <strong>nunca</strong> se
            usaron: sin equipos cargados ni compras registradas.
          </p>
          <p>
            Si ya tienen historial, el sistema lo impide. Los equipos y las ventas
            conservan a qué modelo pertenecen, y borrarlo dejaría registros huérfanos.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
