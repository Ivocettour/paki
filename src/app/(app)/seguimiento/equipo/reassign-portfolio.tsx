"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reassignPortfolioAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";

/// Pasa toda la cartera abierta de una persona a otra, o la reparte entre el
/// resto del equipo. Pide confirmación: mueve muchas consultas de una vez.
export function ReassignPortfolio({
  fromUserId,
  fromName,
  count,
  others,
}: {
  fromUserId: string;
  fromName: string;
  count: number;
  others: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("reparto");
  const [isPending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await reassignPortfolioAction(fromUserId, target);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.data.moved} ${result.data.moved === 1 ? "consulta pasada" : "consultas pasadas"}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)} disabled={others.length === 0}>
        Pasar a otra persona
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Pasar la cartera de ${fromName}`}
        description={`Se pasan las ${count} consultas abiertas. Cada traspaso queda en la auditoría.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button loading={isPending} onClick={confirm}>
              Confirmar
            </Button>
          </>
        }
      >
        <Select value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Destino">
          <option value="reparto">Repartir entre todo el equipo</option>
          {others.map((person) => (
            <option key={person.id} value={person.id}>
              Pasar a {person.name}
            </option>
          ))}
        </Select>
      </Dialog>
    </>
  );
}
