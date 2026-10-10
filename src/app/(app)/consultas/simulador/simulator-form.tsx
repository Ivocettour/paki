"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { simulateInboundAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

const EXAMPLES = [
  { name: "Ana Pérez", phone: "362 412-3456", body: "Hola, ¿tienen el iPhone 15 de 128 GB? ¿Cuánto sale en cuotas?" },
  { name: "Marcos Díaz", phone: "0362 15 4000111", body: "Quiero reservar el Samsung S23, paso hoy a la tarde." },
  { name: "Julia Ríos", phone: "+54 9 362 455-8899", body: "Solo estoy mirando precios, después veo." },
] as const;

export function SimulatorForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [channel, setChannel] = useState<"WHATSAPP" | "WEB">("WHATSAPP");
  const [fullName, setFullName] = useState<string>(EXAMPLES[0].name);
  const [phone, setPhone] = useState<string>(EXAMPLES[0].phone);
  const [body, setBody] = useState<string>(EXAMPLES[0].body);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await simulateInboundAction({ channel, fullName, phone, body });
      if (!result.ok) {
        setError(result.fieldErrors ? "Revisá los datos ingresados." : result.error);
        return;
      }
      toast.success("Mensaje recibido");
      router.push(`/consultas/${result.data.leadId}`);
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

      <div className="flex flex-wrap gap-2" role="group" aria-label="Ejemplos">
        {EXAMPLES.map((example) => (
          <Button
            key={example.name}
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setFullName(example.name);
              setPhone(example.phone);
              setBody(example.body);
            }}
          >
            {example.name}
          </Button>
        ))}
      </div>

      <Field label="Canal" htmlFor="sim-channel">
        <Select id="sim-channel" value={channel} onChange={(event) => setChannel(event.target.value as "WHATSAPP" | "WEB")}>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="WEB">Tienda web</option>
        </Select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nombre" htmlFor="sim-name" required>
          <Input id="sim-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
        </Field>
        <Field label="Teléfono" htmlFor="sim-phone" required hint="Se unifica aunque lo escribas distinto.">
          <Input id="sim-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
      </div>

      <Field label="Mensaje" htmlFor="sim-body" required>
        <Textarea id="sim-body" rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
      </Field>

      <div className="flex justify-end">
        <Button type="button" loading={isPending} onClick={submit}>
          Recibir mensaje
        </Button>
      </div>
    </div>
  );
}
