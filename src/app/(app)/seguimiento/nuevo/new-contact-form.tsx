"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { createManualLeadAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";

export function NewContactForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await createManualLeadAction({
        fullName,
        phone,
        email,
        interestNote: interest,
        note,
      });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success("Contacto cargado");
      router.push(`/consultas/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardBody className="space-y-5">
        {error ? (
          <div role="alert" className="flex items-start gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
            <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        ) : null}

        <Field label="Nombre y apellido" htmlFor="nc-name" required error={fieldErrors.fullName?.[0]}>
          <Input id="nc-name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Teléfono" htmlFor="nc-phone" error={fieldErrors.phone?.[0]} hint="Teléfono o correo: alguno hace falta.">
            <Input id="nc-phone" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label="Correo" htmlFor="nc-email" error={fieldErrors.email?.[0]}>
            <Input id="nc-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
        </div>

        <Field label="Qué busca" htmlFor="nc-interest" hint="Ej.: iPhone 14 de 128 GB, hasta 700 mil.">
          <Input id="nc-interest" value={interest} onChange={(event) => setInterest(event.target.value)} maxLength={200} />
        </Field>

        <Field label="Nota interna" htmlFor="nc-note" hint="Cómo llegó, qué se habló. El cliente no la ve.">
          <Textarea id="nc-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
        </Field>

        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="button" loading={isPending} onClick={submit}>
            Cargar contacto
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
