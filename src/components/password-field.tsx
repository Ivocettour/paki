"use client";

import { useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/// Requisitos que la política de contraseñas exige (ver validations/auth.ts).
const RULES = [
  { label: "Al menos 8 caracteres", test: (value: string) => value.length >= 8 },
  { label: "Una letra minúscula", test: (value: string) => /[a-z]/.test(value) },
  { label: "Una letra mayúscula", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Un número", test: (value: string) => /\d/.test(value) },
] as const;

export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  showRules = false,
  autoComplete = "new-password",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  showRules?: boolean;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <Field label={label} htmlFor={id} required error={error}>
        <div className="relative">
          <Input
            id={id}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            aria-invalid={Boolean(error)}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-tertiary transition-colors hover:text-fg"
          >
            {visible ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </Field>

      {showRules && value.length > 0 ? (
        <ul className="space-y-1">
          {RULES.map((rule) => {
            const passed = rule.test(value);
            return (
              <li
                key={rule.label}
                className={cn(
                  "flex items-center gap-1.5 text-[12px]",
                  passed ? "text-success" : "text-fg-tertiary",
                )}
              >
                {passed ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <X className="size-3.5" aria-hidden />
                )}
                {rule.label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/// Comprueba la política en el cliente, para habilitar el botón de envío.
export function meetsPasswordPolicy(value: string): boolean {
  return RULES.every((rule) => rule.test(value));
}
