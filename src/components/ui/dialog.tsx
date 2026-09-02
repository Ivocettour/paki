"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/// Modal accesible: cierra con Escape, bloquea el scroll del fondo y
/// devuelve el foco al elemento que lo abrió.
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const FOCUSABLE =
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), " +
      "textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

    function focusableElements(): HTMLElement[] {
      return [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      /*
       * Trampa de foco.
       *
       * Sin esto, tabular desde el último control del modal lleva el foco al
       * contenido de atrás, que es inalcanzable visualmente: quien navega con
       * teclado o lector de pantalla queda perdido.
       */
      const elements = focusableElements();
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Enfoca el primer control del modal al abrirse.
    focusableElements()[0]?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={cn(
          "relative w-full overflow-hidden rounded-[18px] bg-surface-raised shadow-[var(--shadow-overlay)]",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 id="dialog-title" className="text-[17px] font-semibold text-fg">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-[14px] text-fg-secondary">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-8 shrink-0 place-items-center rounded-full text-fg-tertiary hover:bg-surface-subtle hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {children ? <div className="px-6 pb-2">{children}</div> : null}

        {footer ? (
          <div className="mt-4 flex justify-end gap-2.5 border-t border-line-subtle px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
