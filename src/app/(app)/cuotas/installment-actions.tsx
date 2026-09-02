"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Check, RotateCcw } from "lucide-react";
import { InstallmentStatus, PaymentMethod } from "@prisma/client";
import { cancelPaymentAction, registerPaymentAction } from "@/lib/actions/installments";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatCurrency, toDateInputValue } from "@/lib/utils";

export function InstallmentActions({
  installmentId,
  amount,
  label,
  status,
  canRegister,
  canCancel,
}: {
  installmentId: string;
  amount: number;
  label: string;
  status: InstallmentStatus;
  canRegister: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // El monto cobrado se precarga con el pactado, pero puede ajustarse.
  const [paidAmount, setPaidAmount] = useState(String(amount));
  const [paidAt, setPaidAt] = useState(toDateInputValue(new Date()));
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.EFECTIVO);
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");

  const isPaid = status === InstallmentStatus.PAGADA;

  function handleRegister() {
    setError(null);

    startTransition(async () => {
      const result = await registerPaymentAction(installmentId, {
        paidAmount: Number(paidAmount),
        paidAt: new Date(paidAt),
        paymentMethod: method,
        notes,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Cobro registrado", {
        description: `Se registró el pago de ${formatCurrency(Number(paidAmount))}.`,
      });
      setPayOpen(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setError(null);

    startTransition(async () => {
      const result = await cancelPaymentAction(installmentId, { reason });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Cobro anulado", {
        description: "La cuota volvió a quedar pendiente.",
      });
      setCancelOpen(false);
      setReason("");
      router.refresh();
    });
  }

  if (isPaid && !canCancel) return null;
  if (!isPaid && !canRegister) return null;

  return (
    <>
      {isPaid ? (
        <Button variant="ghost" size="sm" onClick={() => setCancelOpen(true)}>
          <RotateCcw className="size-3.5" aria-hidden />
          Anular cobro
        </Button>
      ) : (
        <Button size="sm" onClick={() => setPayOpen(true)}>
          <Check className="size-3.5" aria-hidden />
          Registrar cobro
        </Button>
      )}

      <Dialog
        open={payOpen}
        onClose={() => {
          setPayOpen(false);
          setError(null);
        }}
        title="Registrar cobro"
        description={`Monto pactado de la ${label}: ${formatCurrency(amount)}.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              loading={isPending}
              disabled={!paidAmount || Number(paidAmount) <= 0}
              onClick={handleRegister}
            >
              Confirmar cobro
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Monto cobrado" htmlFor="paidAmount" required>
              <Input
                id="paidAmount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={paidAmount}
                onChange={(event) => setPaidAmount(event.target.value)}
              />
            </Field>

            <Field label="Fecha de cobro" htmlFor="paidAt" required>
              <Input
                id="paidAt"
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Método de pago" htmlFor="method" required>
            <Select
              id="method"
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              {Object.values(PaymentMethod).map((value) => (
                <option key={value} value={value}>
                  {PAYMENT_METHOD_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Observaciones" htmlFor="notes">
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opcional"
            />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setError(null);
        }}
        title="Anular el cobro"
        description="La cuota vuelve a quedar pendiente. Queda registrado en la auditoría."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setCancelOpen(false)}
              disabled={isPending}
            >
              Volver
            </Button>
            <Button
              variant="danger"
              loading={isPending}
              disabled={reason.trim().length < 3}
              onClick={handleCancel}
            >
              Anular cobro
            </Button>
          </>
        }
      >
        <Field label="Motivo" htmlFor="cancelReason" required error={error ?? undefined}>
          <Textarea
            id="cancelReason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej.: se registró por error en la cuota equivocada."
          />
        </Field>
      </Dialog>
    </>
  );
}
