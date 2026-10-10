"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { recordIncomingAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";

/// Alta rápida de un mensaje que llegó por fuera del sistema. Pensada para usarla
/// desde el celular: dos campos obligatorios y un botón.
export function IncomingForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function submit() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await recordIncomingAction({ phone, fullName, body });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success("Mensaje anotado");
      router.push(`/consultas/${result.data.leadId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Teléfono de quien escribió"
          htmlFor="in-phone"
          required
          error={fieldErrors.phone?.[0]}
          hint="Como lo ves en WhatsApp. Si ya escribió antes, se une a su consulta."
        >
          <Input id="in-phone" inputMode="tel" autoComplete="off" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+54 9 362 412-3456" />
        </Field>
        <Field label="Nombre" htmlFor="in-name" hint="Opcional. Si lo dejás vacío se usa el número.">
          <Input id="in-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} />
        </Field>
      </div>

      <Field label="Qué te escribió" htmlFor="in-body" required error={fieldErrors.body?.[0]} hint="Copiá y pegá el mensaje de WhatsApp.">
        <Textarea id="in-body" rows={5} value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} />
      </Field>

      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="button" loading={isPending} disabled={!phone.trim() || !body.trim()} onClick={submit}>
          Anotar mensaje
        </Button>
      </div>
    </div>
  );
}
