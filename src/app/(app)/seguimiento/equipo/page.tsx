import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTeamLoad } from "@/lib/services/leads/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { USER_ROLE_LABELS } from "@/lib/constants";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import { ReassignPortfolio } from "./reassign-portfolio";

export const metadata = { title: "Equipo y carga" };

export default async function EquipoPage() {
  const user = await getCurrentUser();
  if (!can(user?.role, "consultas.gestionar")) redirect("/seguimiento");

  const { rows, unassigned } = await getTeamLoad();

  return (
    <>
      <Link href="/seguimiento" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-fg-secondary hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Volver al seguimiento
      </Link>

      <PageHeader
        title="Equipo y carga"
        description="Cuántas consultas abiertas tiene cada persona. Pasá una cartera entera para vacaciones o bajas."
      />

      <Card className="overflow-hidden">
        <CardHeader title="Consultas abiertas por persona" description={unassigned > 0 ? `${unassigned} sin asignar` : undefined} />
        <TableWrapper>
          <Table className="min-w-[760px]">
            <thead>
              <tr>
                <Th>Persona</Th>
                <Th align="right">Abiertas</Th>
                <Th align="right">Sin responder</Th>
                <Th align="right">Para hoy</Th>
                <Th align="right">Vencidas</Th>
                <Th>Pasar cartera</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <span className="font-medium text-fg">{row.name}</span>
                    <span className="ml-2 text-[12px] text-fg-tertiary">{USER_ROLE_LABELS[row.role]}</span>
                  </Td>
                  <Td align="right" className="tabular">{row.open}</Td>
                  <Td align="right" className="tabular">{row.unanswered}</Td>
                  <Td align="right" className="tabular">{row.today}</Td>
                  <Td align="right" className="tabular">{row.overdue}</Td>
                  <Td>
                    {row.open > 0 ? (
                      <ReassignPortfolio
                        fromUserId={row.id}
                        fromName={row.name}
                        count={row.open}
                        others={rows.filter((other) => other.id !== row.id).map((other) => ({ id: other.id, name: other.name }))}
                      />
                    ) : (
                      <span className="text-[13px] text-fg-tertiary">Sin consultas</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      </Card>
    </>
  );
}
