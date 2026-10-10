"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitStoreInquiryAction } from "@/lib/actions/store-inquiry";

/**
 * Formulario de consulta de la tienda. La consulta llega a la bandeja del local
 * ya asociada al equipo; el cliente no necesita cuenta ni WhatsApp.
 *
 * Incluye un campo trampa (`website`) oculto a las personas: si un programa lo
 * completa, el servidor descarta el mensaje.
 */
export function InquiryForm({
  deviceId,
  deviceTitle,
}: {
  deviceId?: string;
  deviceTitle?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const data = new FormData(event.currentTarget);
    const read = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };

    startTransition(async () => {
      const result = await submitStoreInquiryAction({
        deviceId,
        fullName: read("fullName"),
        phone: read("phone"),
        email: read("email"),
        message: read("message"),
        website: read("website"),
      });

      if (!result.ok) {
        setError(result.fieldErrors ? "Revisá los datos marcados." : result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-[20px] bg-success-soft px-5 py-5 text-success">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="text-[17px] font-semibold">¡Recibimos tu consulta!</p>
          <p className="mt-1 text-[14px]">Te vamos a responder lo antes posible por el medio que nos dejaste.</p>
        </div>
      </div>
    );
  }

  const inputClass =
    "h-12 w-full rounded-[12px] border border-line bg-surface-raised px-4 text-[16px] text-fg placeholder:text-fg-tertiary aria-[invalid=true]:border-danger";

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-[12px] bg-danger-soft px-4 py-3 text-[14px] text-danger">
          {error}
        </p>
      ) : null}

      <Field label="Tu nombre" name="fullName" error={fieldErrors.fullName?.[0]}>
        <input id="inq-fullName" name="fullName" autoComplete="name" required maxLength={120} className={inputClass} aria-invalid={Boolean(fieldErrors.fullName)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teléfono" name="phone" error={fieldErrors.phone?.[0]}>
          <input id="inq-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} className={inputClass} aria-invalid={Boolean(fieldErrors.phone)} />
        </Field>
        <Field label="Correo (opcional)" name="email" error={fieldErrors.email?.[0]}>
          <input id="inq-email" name="email" type="email" autoComplete="email" maxLength={160} className={inputClass} aria-invalid={Boolean(fieldErrors.email)} />
        </Field>
      </div>

      <Field label="Tu consulta" name="message" error={fieldErrors.message?.[0]}>
        <textarea
          id="inq-message"
          name="message"
          rows={4}
          required
          maxLength={1000}
          defaultValue={deviceTitle ? `Hola, me interesa el ${deviceTitle}. ¿Sigue disponible?` : ""}
          className={inputClass + " h-auto py-3"}
          aria-invalid={Boolean(fieldErrors.message)}
        />
      </Field>

      {/* Campo trampa: las personas no lo ven; los programas suelen completarlo. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          No completar
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-7 text-[17px] text-white transition-colors hover:bg-accent-hover disabled:opacity-60 sm:w-auto"
      >
        {isPending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
        Enviar consulta
      </button>
      <p className="text-[12px] text-fg-tertiary">
        Usamos tus datos solo para responderte esta consulta.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={`inq-${name}`} className="block text-[14px] font-medium text-fg-secondary">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
