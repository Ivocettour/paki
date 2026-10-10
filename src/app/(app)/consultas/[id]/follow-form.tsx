"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { LeadStage, type LeadPriority } from "@prisma/client";
import { snoozeAction, updateFollowUpAction } from "@/lib/actions/leads";
import { CLOSED_LEAD_STAGES, LEAD_PRIORITY_LABELS, LEAD_STAGE_LABELS, LEAD_STAGE_ORDER } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

const SNOOZES = [
  { days: 3, label: "3 días" },
  { days: 7, label: "1 semana" },
  { days: 14, label: "2 semanas" },
  { days: 30, label: "1 mes" },
] as const;

export function FollowForm({
  leadId,
  initial,
}: {
  leadId: string;
  initial: {
    stage: LeadStage;
    nextContactDate: string;
    nextContactNote: string;
    pauseReason: string;
    lostReason: string;
    manualPriority: LeadPriority | null;
    interestNote: string;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [stage, setStage] = useState<LeadStage>(initial.stage);
  const [date, setDate] = useState(initial.nextContactDate);
  const [note, setNote] = useState(initial.nextContactNote);
  const [pauseReason, setPauseReason] = useState(initial.pauseReason);
  const [lostReason, setLostReason] = useState(initial.lostReason);
  const [priority, setPriority] = useState<string>(initial.manualPriority ?? "");
  const [interest, setInterest] = useState(initial.interestNote);

  const closed = CLOSED_LEAD_STAGES.includes(stage);

  function save() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateFollowUpAction(leadId, {
        stage,
        nextContactDate: closed || !date ? null : date,
        nextContactNote: note,
        pauseReason,
        lostReason,
        manualPriority: priority || null,
        interestNote: interest,
      });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      toast.success("Cambios guardados");
      router.refresh();
    });
  }

  function snooze(days: number) {
    setError(null);
    startTransition(async () => {
      const result = await snoozeAction(leadId, days);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Próximo contacto reprogramado");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger">
          <AlertCircle className="mt-px size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      <Field label="Etapa" htmlFor="stage" error={fieldErrors.stage?.[0]}>
        <Select id="stage" value={stage} onChange={(event) => setStage(event.target.value as LeadStage)}>
          {LEAD_STAGE_ORDER.map((value) => (
            <option key={value} value={value}>
              {LEAD_STAGE_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>

      {stage === LeadStage.EN_PAUSA ? (
        <Field label="Motivo de la pausa" htmlFor="pause" required error={fieldErrors.pauseReason?.[0]} hint="Ej.: cobra a fin de mes, espera el próximo modelo.">
          <Input id="pause" value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} maxLength={300} />
        </Field>
      ) : null}

      {stage === LeadStage.PERDIDO ? (
        <Field label="Por qué se perdió" htmlFor="lost" required error={fieldErrors.lostReason?.[0]}>
          <Input id="lost" value={lostReason} onChange={(event) => setLostReason(event.target.value)} maxLength={300} />
        </Field>
      ) : null}

      {!closed ? (
        <>
          <Field label="Próximo contacto" htmlFor="next-date" error={fieldErrors.nextContactDate?.[0]}>
            <Input id="next-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Reprogramar el próximo contacto">
            {SNOOZES.map((option) => (
              <Button key={option.days} type="button" size="sm" variant="secondary" disabled={isPending} onClick={() => snooze(option.days)}>
                +{option.label}
              </Button>
            ))}
          </div>

          <Field label="Para qué" htmlFor="next-note" hint="Qué hay que decirle o preguntarle.">
            <Input id="next-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} />
          </Field>
        </>
      ) : null}

      <Field label="Qué busca" htmlFor="interest">
        <Input id="interest" value={interest} onChange={(event) => setInterest(event.target.value)} maxLength={200} placeholder="Ej.: iPhone 14 de 128 GB, hasta 700 mil" />
      </Field>

      <Field label="Prioridad" htmlFor="priority" hint="Si no elegís una, se usa la sugerida.">
        <Select id="priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
          <option value="">Automática (sugerida)</option>
          {(Object.keys(LEAD_PRIORITY_LABELS) as LeadPriority[]).map((value) => (
            <option key={value} value={value}>
              {LEAD_PRIORITY_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="button" onClick={save} loading={isPending} className="w-full">
        Guardar cambios
      </Button>
    </div>
  );
}
