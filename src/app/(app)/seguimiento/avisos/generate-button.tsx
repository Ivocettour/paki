"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateDigestAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";

export function GenerateDigestButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await generateDigestAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const { sent, skipped } = result.data;
      toast.success(
        sent.length > 0
          ? `${sent.length} ${sent.length === 1 ? "aviso generado" : "avisos generados"}`
          : "No había nada nuevo para avisar",
        { description: skipped.length > 0 ? `${skipped.length} omitidos (ya avisados o sin pendientes).` : undefined },
      );
      router.refresh();
    });
  }

  return (
    <Button type="button" onClick={run} loading={isPending}>
      Generar los avisos de hoy
    </Button>
  );
}
