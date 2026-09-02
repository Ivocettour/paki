"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { changeOwnPasswordAction } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PasswordField, meetsPasswordPolicy } from "@/components/password-field";

export function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await changeOwnPasswordAction({
        currentPassword,
        password,
        confirmPassword,
      });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success("Contraseña actualizada", {
        description: "Usá la nueva la próxima vez que ingreses.",
      });

      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cambiar mi contraseña"
      description="Por seguridad, primero confirmá tu contraseña actual."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            loading={isPending}
            disabled={
              !currentPassword ||
              !meetsPasswordPolicy(password) ||
              password !== confirmPassword
            }
            onClick={handleSubmit}
          >
            Cambiar contraseña
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger"
          >
            <AlertCircle className="size-4 shrink-0 mt-px" aria-hidden />
            <span>{error}</span>
          </div>
        ) : null}

        <PasswordField
          id="currentPassword"
          label="Contraseña actual"
          value={currentPassword}
          onChange={setCurrentPassword}
          error={fieldErrors.currentPassword?.[0]}
          autoComplete="current-password"
        />

        <div className="space-y-4 border-t border-line-subtle pt-4">
          <PasswordField
            id="ownNewPassword"
            label="Contraseña nueva"
            value={password}
            onChange={setPassword}
            error={fieldErrors.password?.[0]}
            showRules
          />
          <PasswordField
            id="ownConfirmPassword"
            label="Repetir contraseña nueva"
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
      </div>
    </Dialog>
  );
}
