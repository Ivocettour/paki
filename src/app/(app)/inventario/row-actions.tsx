"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Eye, Pencil } from "lucide-react";
import { InventoryStatus } from "@prisma/client";
import { deactivateDeviceAction } from "@/lib/actions/devices";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";

export function DeviceRowActions({
  deviceId,
  deviceLabel,
  inventoryStatus,
  canEdit,
  canDeactivate,
}: {
  deviceId: string;
  deviceLabel: string;
  inventoryStatus: InventoryStatus;
  canEdit: boolean;
  canDeactivate: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isSold = inventoryStatus === InventoryStatus.VENDIDO;
  const alreadyInactive = inventoryStatus === InventoryStatus.INACTIVO;

  function handleDeactivate(forceSold: boolean) {
    setError(null);

    startTransition(async () => {
      const result = await deactivateDeviceAction(deviceId, { reason, forceSold });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Equipo dado de baja", {
        description: `${deviceLabel} pasó a estado Inactivo.`,
      });
      setConfirmOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Link
          href={`/inventario/${deviceId}`}
          aria-label={`Ver detalle de ${deviceLabel}`}
          className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-subtle hover:text-fg"
        >
          <Eye className="size-4" aria-hidden />
        </Link>

        {canEdit ? (
          <Link
            href={`/inventario/${deviceId}/editar`}
            aria-label={`Editar ${deviceLabel}`}
            className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-subtle hover:text-fg"
          >
            <Pencil className="size-4" aria-hidden />
          </Link>
        ) : null}

        {canDeactivate && !alreadyInactive ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label={`Dar de baja ${deviceLabel}`}
            className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Ban className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setError(null);
        }}
        title="Dar de baja el equipo"
        description={`${deviceLabel} pasará a estado Inactivo. No se elimina: se conserva todo su historial.`}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={isPending}
              disabled={reason.trim().length < 3}
              onClick={() => handleDeactivate(isSold)}
            >
              {isSold ? "Confirmar baja administrativa" : "Dar de baja"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {isSold ? (
            <div className="rounded-[12px] bg-warning-soft px-3.5 py-3 text-[13px] text-warning">
              Este equipo tiene una venta asociada. Darlo de baja es una operación
              administrativa excepcional y queda registrada en la auditoría.
            </div>
          ) : null}

          <Field
            label="Motivo de la baja"
            htmlFor="reason"
            required
            error={error ?? undefined}
            hint="Queda registrado en el historial y en la auditoría."
          >
            <Textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej.: equipo con falla irreparable devuelto al proveedor."
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}
