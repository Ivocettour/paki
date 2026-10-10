"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reassignLeadAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";

/// Solo administración: pasa la consulta a otra persona.
export function ReassignForm({
  leadId,
  current,
  people,
}: {
  leadId: string;
  current: string | null;
  people: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(current ?? "");

  function save() {
    startTransition(async () => {
      const result = await reassignLeadAction(leadId, value || null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Consulta reasignada");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={value} onChange={(event) => setValue(event.target.value)} aria-label="Responsable">
        <option value="">Sin asignar</option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </Select>
      <Button type="button" size="sm" variant="secondary" loading={isPending} disabled={value === (current ?? "")} onClick={save}>
        Pasar
      </Button>
    </div>
  );
}
