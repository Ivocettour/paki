"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Ban } from "lucide-react";
import { cancelSaleAction } from "@/lib/actions/sales";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";

export function CancelSaleButton({
  saleId,
  saleNumber,
  deviceCount,
  hasPaidInstallments,
}: {
  saleId: string;
  saleNumber: string;
  deviceCount: number;
  hasPaidInstallments: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setError(null);

    startTransition(async () => {
      const result = await cancelSaleAction(saleId, { reason });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(`Venta ${saleNumber} anulada`, {
        description: `${deviceCount} ${
          deviceCount === 1 ? "equipo volvió" : "equipos volvieron"
        } al inventario.`,
      });

      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        <Ban className="size-4" aria-hidden />
        Anular venta
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title={`Anular la venta ${saleNumber}`}
        description="La venta se conserva en el historial con estado Anulada. No se elimina."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Volver
            </Button>
            <Button
              variant="danger"
              loading={isPending}
              disabled={reason.trim().length < 5}
              onClick={handleCancel}
            >
              Anular venta
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

          <ul className="space-y-1.5 rounded-[12px] bg-surface-subtle px-4 py-3 text-[13px] text-fg-secondary">
            <li>
              · {deviceCount} {deviceCount === 1 ? "equipo vuelve" : "equipos vuelven"} a estado
              Disponible.
            </li>
            <li>· Se registra el movimiento de stock inverso.</li>
            <li>· Las cuotas pendientes dejan de reclamarse.</li>
            {hasPaidInstallments ? (
              <li className="text-warning">
                · Las cuotas ya cobradas se conservan: registran plata que entró y su
                devolución se gestiona aparte.
              </li>
            ) : null}
          </ul>

          <Field
            label="Motivo de la anulación"
            htmlFor="cancelReason"
            required
            hint="Queda registrado en la auditoría con tu nombre y la fecha."
          >
            <Textarea
              id="cancelReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej.: el cliente se arrepintió y devolvió el equipo sin uso."
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
