"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MessageSquarePlus } from "lucide-react";
import { recordIncomingAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

/// Anota lo que esta persona te contestó por tu WhatsApp personal, para que la
/// conversación del panel quede completa y la consulta vuelva a "esperando respuesta".
export function IncomingNote({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await recordIncomingAction({ leadId, body });
      if (!result.ok) {
        setError(result.fieldErrors?.body?.[0] ?? result.error);
        return;
      }
      toast.success("Mensaje anotado");
      setBody("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <MessageSquarePlus className="size-4" aria-hidden />
        Anotar lo que me contestó
      </Button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-[14px] border border-line-subtle p-3.5">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={4000}
        placeholder="Pegá lo que te escribió por WhatsApp…"
        aria-label="Mensaje recibido"
        autoFocus
      />
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" size="sm" loading={isPending} disabled={!body.trim()} onClick={save}>
          Anotar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
