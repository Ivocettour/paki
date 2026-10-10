"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CheckCheck, ExternalLink } from "lucide-react";
import { markRepliedAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/field";

/**
 * Responder desde el WhatsApp propio.
 *
 * Mientras el sistema no tenga un número de WhatsApp que pueda escribirle a
 * cualquier cliente (el de prueba de Meta solo habla con una lista corta), la
 * respuesta se manda desde el celular o WhatsApp Web de quien atiende. Acá se
 * abre ese chat con el texto ya escrito y después se deja registrado.
 */
export function ManualReply({
  leadId,
  phone,
  initialText,
  draftId,
}: {
  leadId: string;
  phone: string | null;
  initialText: string;
  draftId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState(initialText);
  const [firstPrice, setFirstPrice] = useState(false);
  const [nextDays, setNextDays] = useState("3");
  const [error, setError] = useState<string | null>(null);

  if (!phone) return null;

  // wa.me exige solo dígitos, con código de país.
  const waLink = `https://wa.me/${phone.replace(/\D/g, "")}${text.trim() ? `?text=${encodeURIComponent(text.trim())}` : ""}`;

  function register() {
    setError(null);
    startTransition(async () => {
      const result = await markRepliedAction({
        leadId,
        body: text,
        draftId,
        markPriceSent: firstPrice || undefined,
        nextContactDays: Number(nextDays) || undefined,
      });

      if (!result.ok) {
        setError(result.fieldErrors?.body?.[0] ?? result.error);
        return;
      }
      toast.success("Respuesta registrada");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-fg-secondary">
        ¿El envío desde el sistema no está disponible (por ejemplo, con el número de prueba de Meta)?
        Mandalo desde tu propio WhatsApp y dejalo registrado acá.
      </p>

      {error ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="manual-text">Mensaje</Label>
        <Textarea
          id="manual-text"
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={4000}
          placeholder="Escribí o pegá lo que le vas a mandar…"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-success px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <ExternalLink className="size-4" aria-hidden />
          Abrir en mi WhatsApp
        </a>
        <span className="text-[12px] text-fg-tertiary">
          Se abre el chat con el texto escrito; solo falta enviar.
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line-subtle pt-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-[13px] text-fg-secondary">
            <input
              type="checkbox"
              checked={firstPrice}
              onChange={(event) => setFirstPrice(event.target.checked)}
              className="size-4 rounded border-line accent-[var(--accent)]"
            />
            Es el primer precio
          </label>
          <label className="flex items-center gap-2 text-[13px] text-fg-secondary">
            Volver a escribirle
            <Select
              value={nextDays}
              onChange={(event) => setNextDays(event.target.value)}
              className="h-9 w-auto min-w-[8.5rem] text-[13px]"
              aria-label="Cuándo volver a escribirle si no responde"
            >
              <option value="">sin fecha</option>
              <option value="1">mañana</option>
              <option value="3">en 3 días</option>
              <option value="7">en 1 semana</option>
              <option value="14">en 2 semanas</option>
            </Select>
          </label>
        </div>

        <Button type="button" variant="secondary" loading={isPending} disabled={!text.trim()} onClick={register}>
          <CheckCheck className="size-4" aria-hidden />
          Ya lo envié: marcar como respondida
        </Button>
      </div>
    </div>
  );
}
