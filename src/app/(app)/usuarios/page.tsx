import { redirect } from "next/navigation";
import { ShieldAlert, Users } from "lucide-react";
import { userFiltersSchema } from "@/lib/validations/user";
import { listUsers } from "@/lib/services/users";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrapper, Td, Th, Tr } from "@/components/ui/table";
import { USER_ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, initials } from "@/lib/utils";
import { NewUserButton, UserFilters, UserRowActions } from "./user-ui";

export const metadata = { title: "Usuarios" };

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  // Barrera de servidor: la sección no existe para quien no la tiene permitida.
  if (!can(user?.role, "usuarios.ver")) redirect("/");

  const params = await searchParams;
  const parsed = userFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : userFiltersSchema.parse({});

  const result = await listUsers(filters);

  const canCreate = can(user?.role, "usuarios.crear");
  const canEdit = can(user?.role, "usuarios.editar");
  const canDeactivate = can(user?.role, "usuarios.desactivar");

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Los usuarios no se eliminan: se desactivan y conservan su historial."
        action={canCreate ? <NewUserButton /> : null}
      />

      {result.activeAdmins === 1 ? (
        <div
          role="status"
          className="mb-5 flex items-start gap-2.5 rounded-[14px] bg-warning-soft px-4 py-3 text-[13px] text-warning"
        >
          <ShieldAlert className="size-4 shrink-0 mt-px" aria-hidden />
          <span>
            Queda un solo administrador activo. Conviene designar al menos otro: si esa
            cuenta se desactiva o se pierde el acceso, nadie podría administrar el sistema.
          </span>
        </div>
      ) : null}

      <UserFilters />

      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No se encontraron usuarios"
            description="Probá ajustando la búsqueda o los filtros."
          />
        ) : (
          <TableWrapper>
            <Table>
              <thead>
                <tr>
                  <Th>Usuario</Th>
                  <Th>Rol</Th>
                  <Th>Estado</Th>
                  <Th>Último acceso</Th>
                  <Th>Alta</Th>
                  <Th align="center">Operaciones</Th>
                  <Th align="right">
                    <span className="sr-only">Acciones</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((row) => {
                  const totalActivity =
                    row.activity.sales + row.activity.devices + row.activity.movements;

                  return (
                    <Tr key={row.id} className={row.status === "INACTIVO" ? "opacity-60" : ""}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <span
                            className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-subtle text-[12px] font-semibold text-fg-secondary"
                            aria-hidden
                          >
                            {initials(row.firstName, row.lastName)}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium">
                              {row.fullName}
                              {row.isSelf ? (
                                <span className="ml-2 text-[12px] font-normal text-fg-tertiary">
                                  (vos)
                                </span>
                              ) : null}
                            </span>
                            <span className="block truncate text-[12px] text-fg-tertiary">
                              {row.email}
                            </span>
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={row.role === "ADMINISTRADOR" ? "accent" : "neutral"}>
                          {USER_ROLE_LABELS[row.role]}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge tone={row.status === "ACTIVO" ? "success" : "danger"}>
                          {USER_STATUS_LABELS[row.status]}
                        </Badge>
                      </Td>
                      <Td>
                        <span className="text-[13px] text-fg-secondary">
                          {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "Nunca ingresó"}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-[13px] text-fg-secondary">
                          {formatDate(row.createdAt)}
                        </span>
                      </Td>
                      <Td align="center">
                        <span
                          className="tabular text-[13px] text-fg-secondary"
                          title={`${row.activity.sales} ventas · ${row.activity.devices} altas de equipos · ${row.activity.movements} movimientos`}
                        >
                          {totalActivity}
                        </span>
                      </Td>
                      <Td align="right">
                        <UserRowActions
                          user={{
                            id: row.id,
                            firstName: row.firstName,
                            lastName: row.lastName,
                            email: row.email,
                            role: row.role,
                            status: row.status,
                            fullName: row.fullName,
                            isSelf: row.isSelf,
                          }}
                          canEdit={canEdit}
                          canDeactivate={canDeactivate}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrapper>
        )}
      </Card>

      <p className="mt-4 text-[13px] text-fg-tertiary">
        {result.total} {result.total === 1 ? "usuario" : "usuarios"} ·{" "}
        {result.activeAdmins}{" "}
        {result.activeAdmins === 1 ? "administrador activo" : "administradores activos"}
      </p>
    </>
  );
}
