"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { KeyRound, LogOut } from "lucide-react";
import type { UserRole } from "@prisma/client";
import { USER_ROLE_LABELS } from "@/lib/constants";
import { cn, initials } from "@/lib/utils";
import { ChangePasswordDialog } from "./change-password-dialog";

export function UserMenu({
  firstName,
  lastName,
  email,
  role,
}: {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
}) {
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors",
          "hover:bg-surface-subtle",
        )}
      >
        <span
          className="grid size-8 place-items-center rounded-full bg-fg text-[12px] font-semibold text-surface"
          aria-hidden
        >
          {initials(firstName, lastName)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-[13px] font-medium leading-tight text-fg">
            {firstName} {lastName}
          </span>
          <span className="block text-[11px] leading-tight text-fg-tertiary">
            {USER_ROLE_LABELS[role]}
          </span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-[14px] border border-line-subtle bg-surface-raised shadow-[var(--shadow-overlay)]"
        >
          <div className="border-b border-line-subtle px-4 py-3">
            <p className="text-[13px] font-medium text-fg">
              {firstName} {lastName}
            </p>
            <p className="truncate text-[12px] text-fg-tertiary">{email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setPasswordOpen(true);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[13px] text-fg transition-colors hover:bg-surface-subtle"
          >
            <KeyRound className="size-4 text-fg-tertiary" aria-hidden />
            Cambiar mi contraseña
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-2.5 border-t border-line-subtle px-4 py-3 text-left text-[13px] text-fg transition-colors hover:bg-surface-subtle"
          >
            <LogOut className="size-4 text-fg-tertiary" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      ) : null}

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
