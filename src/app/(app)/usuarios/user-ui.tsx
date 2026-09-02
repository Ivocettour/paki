"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, KeyRound, Pencil, Plus, Search, UserCheck, UserX, X } from "lucide-react";
import { UserRole, UserStatus } from "@prisma/client";
import {
  createUserAction,
  resetPasswordAction,
  setUserStatusAction,
  updateUserAction,
} from "@/lib/actions/users";
import { USER_ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Select } from "@/components/ui/field";
import { PasswordField, meetsPasswordPolicy } from "@/components/password-field";

interface UserValues {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isSelf: boolean;
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger"
    >
      <AlertCircle className="size-4 shrink-0 mt-px" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

function UserDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user?: UserValues;
}) {
  const router = useRouter();
  const isEdit = Boolean(user);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<UserRole>(user?.role ?? UserRole.VENDEDOR);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const canSubmit =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    email.trim().length > 0 &&
    (isEdit || (meetsPasswordPolicy(password) && password === confirmPassword));

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = isEdit
        ? await updateUserAction(user!.id, { firstName, lastName, email, role })
        : await createUserAction({
            firstName,
            lastName,
            email,
            role,
            password,
            confirmPassword,
          });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success(isEdit ? "Usuario actualizado" : "Usuario creado", {
        description: isEdit
          ? undefined
          : "Pedile que cambie la contraseña la primera vez que entre.",
      });
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar usuario" : "Nuevo usuario"}
      description={
        isEdit
          ? "La contraseña se cambia por separado, desde restablecer contraseña."
          : "Se crea con una contraseña inicial que el usuario debería cambiar."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button loading={isPending} disabled={!canSubmit} onClick={handleSubmit}>
            {isEdit ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBanner message={error} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="firstName" required error={fieldErrors.firstName?.[0]}>
            <Input
              id="firstName"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </Field>

          <Field label="Apellido" htmlFor="lastName" required error={fieldErrors.lastName?.[0]}>
            <Input
              id="lastName"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>

          <Field
            label="Email"
            htmlFor="email"
            required
            error={fieldErrors.email?.[0]}
            hint="Es el usuario con el que va a ingresar."
            className="sm:col-span-2"
          >
            <Input
              id="email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field
            label="Rol"
            htmlFor="role"
            required
            error={fieldErrors.role?.[0]}
            hint={
              role === UserRole.ADMINISTRADOR
                ? "Acceso completo al sistema."
                : "Puede vender y consultar, sin tocar precios ni configuración."
            }
            className="sm:col-span-2"
          >
            <Select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              {Object.values(UserRole).map((value) => (
                <option key={value} value={value}>
                  {USER_ROLE_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {!isEdit ? (
          <div className="space-y-4 border-t border-line-subtle pt-4">
            <PasswordField
              id="password"
              label="Contraseña inicial"
              value={password}
              onChange={setPassword}
              error={fieldErrors.password?.[0]}
              showRules
            />
            <PasswordField
              id="confirmPassword"
              label="Repetir contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={
                fieldErrors.confirmPassword?.[0] ??
                (confirmPassword && password !== confirmPassword
                  ? "Las contraseñas no coinciden."
                  : undefined)
              }
            />
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

export function NewUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Nuevo usuario
      </Button>
      {open ? <UserDialog open={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function UserRowActions({
  user,
  canEdit,
  canDeactivate,
}: {
  user: UserValues;
  canEdit: boolean;
  canDeactivate: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const willDeactivate = user.status === UserStatus.ACTIVO;

  function handleResetPassword() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await resetPasswordAction(user.id, { password, confirmPassword });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success("Contraseña restablecida", {
        description: `Pasale la nueva contraseña a ${user.firstName} por un canal seguro.`,
      });
      setPasswordOpen(false);
      setPassword("");
      setConfirmPassword("");
    });
  }

  function handleToggleStatus() {
    setError(null);

    startTransition(async () => {
      const result = await setUserStatusAction(
        user.id,
        willDeactivate ? UserStatus.INACTIVO : UserStatus.ACTIVO,
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(willDeactivate ? "Usuario desactivado" : "Usuario reactivado", {
        description: willDeactivate
          ? "Ya no puede iniciar sesión. Su historial se conserva."
          : "Puede volver a iniciar sesión.",
      });
      setStatusOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {canEdit ? (
          <>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              aria-label={`Editar ${user.fullName}`}
              className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-subtle hover:text-fg"
            >
              <Pencil className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              aria-label={`Restablecer contraseña de ${user.fullName}`}
              className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-subtle hover:text-fg"
            >
              <KeyRound className="size-4" aria-hidden />
            </button>
          </>
        ) : null}

        {/* Nadie puede desactivar su propia cuenta: quedaría fuera al instante. */}
        {canDeactivate && !user.isSelf ? (
          <button
            type="button"
            onClick={() => setStatusOpen(true)}
            aria-label={
              willDeactivate
                ? `Desactivar a ${user.fullName}`
                : `Reactivar a ${user.fullName}`
            }
            className={
              willDeactivate
                ? "grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
                : "grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-success-soft hover:text-success"
            }
          >
            {willDeactivate ? (
              <UserX className="size-4" aria-hidden />
            ) : (
              <UserCheck className="size-4" aria-hidden />
            )}
          </button>
        ) : null}
      </div>

      {editOpen ? (
        <UserDialog open={editOpen} onClose={() => setEditOpen(false)} user={user} />
      ) : null}

      <Dialog
        open={passwordOpen}
        onClose={() => {
          setPasswordOpen(false);
          setError(null);
        }}
        title="Restablecer contraseña"
        description={`Se le asigna una contraseña nueva a ${user.fullName}. La anterior deja de servir.`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setPasswordOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              loading={isPending}
              disabled={!meetsPasswordPolicy(password) || password !== confirmPassword}
              onClick={handleResetPassword}
            >
              Restablecer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ErrorBanner message={error} />
          <PasswordField
            id="newPassword"
            label="Contraseña nueva"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password?.[0]}
            showRules
          />
          <PasswordField
            id="confirmNewPassword"
            label="Repetir contraseña"
            value={confirmPassword}
            onChange={setConfirmPassword}
            error={
              fieldErrors.confirmPassword?.[0] ??
              (confirmPassword && password !== confirmPassword
                ? "Las contraseñas no coinciden."
                : undefined)
            }
          />
        </div>
      </Dialog>

      <Dialog
        open={statusOpen}
        onClose={() => {
          setStatusOpen(false);
          setError(null);
        }}
        title={willDeactivate ? "Desactivar usuario" : "Reactivar usuario"}
        description={
          willDeactivate
            ? `${user.fullName} no va a poder iniciar sesión. Su historial de operaciones se conserva intacto.`
            : `${user.fullName} va a poder volver a iniciar sesión.`
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              variant={willDeactivate ? "danger" : "primary"}
              loading={isPending}
              onClick={handleToggleStatus}
            >
              {willDeactivate ? "Desactivar" : "Reactivar"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ErrorBanner message={error} />
          {willDeactivate ? (
            <ul className="space-y-1.5 rounded-[12px] bg-surface-subtle px-4 py-3 text-[13px] text-fg-secondary">
              <li>· Sus ventas, altas y movimientos siguen registrados a su nombre.</li>
              <li>· Si tiene la sesión abierta, se corta en la próxima acción.</li>
              <li>· Se puede reactivar en cualquier momento.</li>
            </ul>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

export function UserFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const applied = searchParams.get("search") ?? "";

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => router.push(`/usuarios?${params.toString()}`));
  }

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <form
        key={applied}
        className="relative flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("search");
          apply({ search: typeof value === "string" ? value.trim() : undefined });
        }}
      >
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary"
          aria-hidden
        />
        <Input
          name="search"
          defaultValue={applied}
          placeholder="Buscar por nombre, apellido o email…"
          aria-label="Buscar usuarios"
          className="pl-10 pr-10"
        />
        {applied ? (
          <button
            type="button"
            onClick={() => apply({ search: undefined })}
            aria-label="Limpiar búsqueda"
            className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-tertiary hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </form>

      <div className="w-full sm:w-48">
        <Label htmlFor="roleFilter">Rol</Label>
        <Select
          id="roleFilter"
          className="mt-1.5"
          value={searchParams.get("role") ?? ""}
          onChange={(event) => apply({ role: event.target.value })}
        >
          <option value="">Todos</option>
          {Object.values(UserRole).map((value) => (
            <option key={value} value={value}>
              {USER_ROLE_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-full sm:w-48">
        <Label htmlFor="statusFilter">Estado</Label>
        <Select
          id="statusFilter"
          className="mt-1.5"
          value={searchParams.get("status") ?? ""}
          onChange={(event) => apply({ status: event.target.value })}
        >
          <option value="">Todos</option>
          {Object.values(UserStatus).map((value) => (
            <option key={value} value={value}>
              {USER_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
