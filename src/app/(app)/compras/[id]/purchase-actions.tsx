"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Ban, CheckCircle2 } from "lucide-react";
import { cancelPurchaseAction, confirmPurchaseAction } from "@/lib/actions/purchases";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger"
    >
      <AlertCircle className="size-4 shrink-0 mt-px" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function PurchaseActions({
  purchaseId,
  purchaseNumber,
  deviceCount,
  accessoryUnits,
}: {
  purchaseId: string;
  purchaseNumber: string;
  deviceCount: number;
  accessoryUnits: number;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);

    startTransition(async () => {
      const result = await confirmPurchaseAction(purchaseId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(`Compra ${purchaseNumber} confirmada`, {
        description: "La mercadería ya está disponible en el inventario.",
      });
      setConfirmOpen(false);
      router.refresh();
    });
  }

  function handleCancel() {
    setError(null);

    startTransition(async () => {
      const result = await cancelPurchaseAction(purchaseId, { reason });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(`Compra ${purchaseNumber} anulada`);
      setCancelOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex gap-2.5">
        <Button variant="secondary" onClick={() => setCancelOpen(true)}>
          <Ban className="size-4" aria-hidden />
          Anular
        </Button>
        <Button onClick={() => setConfirmOpen(true)}>
          <CheckCircle2 className="size-4" aria-hidden />
          Confirmar e ingresar stock
        </Button>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setError(null);
        }}
        title="Confirmar la compra"
        description="La mercadería ingresa al inventario en este momento."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button loading={isPending} onClick={handleConfirm}>
              Confirmar e ingresar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ErrorBanner message={error} />

          <ul className="space-y-1.5 rounded-[12px] bg-surface-subtle px-4 py-3 text-[13px] text-fg-secondary">
            {deviceCount > 0 ? (
              <li>
                · Se crean {deviceCount}{" "}
                {deviceCount === 1 ? "equipo" : "equipos"} en el inventario, cada uno con su
                ficha.
              </li>
            ) : null}
            {accessoryUnits > 0 ? (
              <li>
                · Se suman {accessoryUnits}{" "}
                {accessoryUnits === 1 ? "unidad" : "unidades"} al stock de accesorios.
              </li>
            ) : null}
            <li>· Cada ingreso deja su movimiento de stock.</li>
            <li className="text-warning">
              · Una vez confirmada, la compra ya no se puede anular.
            </li>
          </ul>
        </div>
      </Dialog>

      <Dialog
        open={cancelOpen}
        onClose={() => {
          setCancelOpen(false);
          setError(null);
        }}
        title={`Anular la compra ${purchaseNumber}`}
        description="La compra queda registrada como anulada. No se ingresa nada al inventario."
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
              disabled={reason.trim().length < 5}
              onClick={handleCancel}
            >
              Anular compra
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ErrorBanner message={error} />
          <Field
            label="Motivo de la anulación"
            htmlFor="cancelReason"
            required
            hint="Queda registrado en la auditoría."
          >
            <Textarea
              id="cancelReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej.: el proveedor no entregó la mercadería."
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
