"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Clock, Send, Sparkles } from "lucide-react";
import {
  regenerateDraftAction,
  rewriteDraftAction,
  sendReplyAction,
} from "@/lib/actions/leads";
import { renderTemplate } from "@/lib/integrations/whatsapp/rules";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { formatDateTime } from "@/lib/utils";

export interface TemplateOption {
  key: string;
  label: string;
  hint: string;
  text: string;
  fields: Array<{
    index: number;
    id: string;
    label: string;
    kind: "contact-name" | "sender-name" | "text" | "date" | "time";
    placeholder?: string;
    max?: number;
  }>;
}

type Notice = { tone: "error" | "warning"; text: string } | null;

/**
 * Panel de respuesta.
 *
 * WhatsApp solo permite texto libre dentro de las 24 h desde el último mensaje de
 * la persona por WhatsApp. Fuera de esa ventana (o si consultó desde la tienda y
 * nunca escribió por ahí) el sistema solo deja mandar una plantilla aprobada.
 * Esa decisión la toma el servidor; acá solo se muestra la opción que corresponde.
 */
export function ReplyPanel({
  leadId,
  leadFirstName,
  senderFirstName,
  hasPhone,
  mode,
  draft,
  templates,
}: {
  leadId: string;
  leadFirstName: string;
  senderFirstName: string;
  hasPhone: boolean;
  mode: "text" | "template" | "blocked";
  draft: { id: string; body: string; generatedBy: string; createdAt: Date } | null;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice>(null);

  const [text, setText] = useState(draft?.body ?? "");
  const [draftId, setDraftId] = useState(draft?.id ?? null);
  const [firstPrice, setFirstPrice] = useState(false);
  const [nextDays, setNextDays] = useState("3");

  const [templateKey, setTemplateKey] = useState(templates[0]?.key ?? "");
  const [values, setValues] = useState<Record<string, string>>({});
  const template = templates.find((t) => t.key === templateKey);

  if (!hasPhone) {
    return (
      <div className="rounded-[14px] bg-surface-subtle px-4 py-4 text-[14px] text-fg-secondary">
        Esta persona no dejó teléfono, así que no se le puede escribir por WhatsApp. Contactala por correo.
      </div>
    );
  }

  function handleResult(result: Awaited<ReturnType<typeof sendReplyAction>>) {
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error });
      return;
    }

    const outcome = result.data;
    if (outcome.status === "sent") {
      toast.success(outcome.viaTemplate ? "Plantilla enviada" : "Mensaje enviado");
      setNotice(null);
      setText(outcome.viaTemplate ? text : "");
      router.refresh();
    } else if (outcome.status === "blocked") {
      setNotice({
        tone: "warning",
        text: `Ya le mandaste ${
          outcome.kind === "exact" ? "exactamente esto" : "algo casi igual"
        } ${formatDateTime(outcome.previousAt)}: “${outcome.previousBody.slice(0, 120)}${
          outcome.previousBody.length > 120 ? "…" : ""
        }”. Cambialo antes de enviar.`,
      });
    } else {
      setNotice({ tone: "error", text: outcome.error });
    }
  }

  function sendText() {
    setNotice(null);
    startTransition(async () => {
      handleResult(
        await sendReplyAction({
          leadId,
          body: text,
          draftId,
          markPriceSent: firstPrice || undefined,
          nextContactDays: Number(nextDays) || undefined,
        }),
      );
    });
  }

  function sendTemplate() {
    setNotice(null);
    startTransition(async () => {
      handleResult(
        await sendReplyAction({
          leadId,
          body: "",
          template: { key: templateKey, values },
          nextContactDays: Number(nextDays) || undefined,
        }),
      );
    });
  }

  function regenerate() {
    setNotice(null);
    startTransition(async () => {
      const result = await regenerateDraftAction(leadId);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setText(result.data.body);
      setDraftId(null);
      if (result.data.warning) {
        setNotice({ tone: "warning", text: `La IA no respondió (${result.data.warning}). Se usó un borrador simple.` });
      }
      router.refresh();
    });
  }

  function rewrite(style: "brief" | "formal") {
    setNotice(null);
    startTransition(async () => {
      const result = await rewriteDraftAction(text, style);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setText(result.data.text);
    });
  }

  const preview = template
    ? renderTemplate(
        template.text,
        template.fields
          .slice()
          .sort((a, b) => a.index - b.index)
          .map((field) =>
            field.kind === "contact-name"
              ? leadFirstName
              : field.kind === "sender-name"
                ? senderFirstName
                : values[field.id] || `{{${field.index}}}`,
          ),
      )
    : "";

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          role="alert"
          className={
            "flex items-start gap-2.5 rounded-[12px] px-3.5 py-3 text-[13px] " +
            (notice.tone === "error" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")
          }
        >
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
          <span>{notice.text}</span>
        </div>
      ) : null}

      {mode === "text" ? (
        <>
          {draft ? (
            <p className="flex items-center gap-1.5 text-[12px] text-fg-tertiary">
              <Sparkles className="size-3.5" aria-hidden />
              Borrador preparado por {draft.generatedBy.startsWith("mock") ? "el asistente simple" : "la IA"}.
              Revisalo y corregilo: no se envía solo.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="reply-text">Mensaje de WhatsApp</Label>
            <Textarea
              id="reply-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={7}
              placeholder="Escribí tu respuesta…"
              maxLength={4000}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={regenerate} disabled={isPending}>
              <Sparkles className="size-4" aria-hidden />
              Otro borrador
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => rewrite("brief")} disabled={isPending || !text.trim()}>
              Más breve
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => rewrite("formal")} disabled={isPending || !text.trim()}>
              Más formal
            </Button>
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
                Es el primer precio (pasa a “Precio enviado”)
              </label>
              <NextContactSelect value={nextDays} onChange={setNextDays} />
            </div>

            <Button type="button" loading={isPending} disabled={!text.trim()} onClick={sendText}>
              <Send className="size-4" aria-hidden />
              Enviar
            </Button>
          </div>
        </>
      ) : mode === "template" ? (
        <>
          <div className="flex items-start gap-2.5 rounded-[12px] bg-accent-soft px-3.5 py-3 text-[13px] text-accent">
            <Clock className="mt-px size-4 shrink-0" aria-hidden />
            <span>
              Pasaron más de 24 horas desde su último WhatsApp (o todavía no escribió por ahí). WhatsApp
              solo permite mandar ahora una plantilla aprobada; cuando responda, vas a poder escribirle libremente.
            </span>
          </div>

          {draft ? (
            <details className="rounded-[12px] border border-line-subtle px-3.5 py-2.5 text-[13px]">
              <summary className="cursor-pointer text-fg-secondary">Borrador guardado para cuando responda</summary>
              <p className="mt-2 whitespace-pre-wrap text-fg">{draft.body}</p>
            </details>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="template">Plantilla</Label>
            <Select id="template" value={templateKey} onChange={(event) => setTemplateKey(event.target.value)}>
              {templates.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
            {template ? <p className="text-[12px] text-fg-tertiary">{template.hint}</p> : null}
          </div>

          {template
            ? template.fields
                .filter((field) => !["contact-name", "sender-name"].includes(field.kind))
                .map((field) => (
                  <div key={field.id} className="space-y-1.5">
                    <Label htmlFor={`tf-${field.id}`} required>
                      {field.label}
                    </Label>
                    <Input
                      id={`tf-${field.id}`}
                      type={field.kind === "date" ? "date" : field.kind === "time" ? "time" : "text"}
                      value={values[field.id] ?? ""}
                      placeholder={field.placeholder}
                      maxLength={field.max}
                      onChange={(event) => setValues((v) => ({ ...v, [field.id]: event.target.value }))}
                    />
                  </div>
                ))
            : null}

          {preview ? (
            <div className="rounded-[12px] bg-surface-subtle px-3.5 py-3">
              <p className="mb-1 text-[12px] font-medium text-fg-tertiary">Así le va a llegar</p>
              <p className="whitespace-pre-wrap text-[14px] text-fg">{preview}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-line-subtle pt-4">
            <NextContactSelect value={nextDays} onChange={setNextDays} />
            <Button type="button" loading={isPending} disabled={!template} onClick={sendTemplate}>
              <Send className="size-4" aria-hidden />
              Enviar plantilla
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-[12px] bg-warning-soft px-3.5 py-3 text-[13px] text-warning">
          Pasaron más de 24 horas desde su último mensaje y no hay una plantilla de WhatsApp aprobada
          configurada para volver a escribirle. Pedile al administrador que la cargue en Canales.
        </div>
      )}
    </div>
  );
}

function NextContactSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-fg-secondary">
      Si no responde, volver a escribirle
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
  );
}
