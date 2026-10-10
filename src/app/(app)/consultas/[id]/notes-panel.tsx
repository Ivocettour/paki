"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { addNoteAction, deleteNoteAction } from "@/lib/actions/leads";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { formatDateTime } from "@/lib/utils";

interface Note {
  id: string;
  body: string;
  createdAt: Date;
  authorName: string;
  canDelete: boolean;
}

/// Notas internas: nunca se le envían al cliente ni se le pasan a la IA.
export function NotesPanel({ leadId, notes }: { leadId: string; notes: Note[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    startTransition(async () => {
      const result = await addNoteAction(leadId, { body });
      if (!result.ok) {
        setError(result.fieldErrors?.body?.[0] ?? result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteNoteAction(id, leadId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Una nota para el equipo. El cliente no la ve."
          rows={3}
          maxLength={2000}
          aria-label="Nueva nota interna"
        />
        {error ? (
          <p role="alert" className="text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        <Button type="button" size="sm" variant="secondary" loading={isPending} disabled={!body.trim()} onClick={add}>
          Agregar nota
        </Button>
      </div>

      {notes.length === 0 ? (
        <p className="text-[13px] text-fg-tertiary">Todavía no hay notas.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-[12px] bg-surface-subtle px-3.5 py-3">
              <p className="whitespace-pre-wrap text-[14px] text-fg">{note.body}</p>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-fg-tertiary">
                <span>
                  {note.authorName} · {formatDateTime(note.createdAt)}
                </span>
                {note.canDelete ? (
                  <button
                    type="button"
                    onClick={() => remove(note.id)}
                    disabled={isPending}
                    aria-label="Borrar nota"
                    className="grid size-7 place-items-center rounded-full hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
