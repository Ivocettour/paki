"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { CustomerDialog, type CustomerValues } from "@/components/customer-dialog";

export function NewCustomerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Nuevo cliente
      </Button>

      <CustomerDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

export function EditCustomerButton({ customer }: { customer: CustomerValues }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Editar
      </Button>

      <CustomerDialog
        open={open}
        customer={customer}
        onClose={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

export function CustomerSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const applied = searchParams.get("search") ?? "";

  function apply(value?: string) {
    const params = new URLSearchParams();
    if (value) params.set("search", value);
    startTransition(() => router.push(`/clientes?${params.toString()}`));
  }

  return (
    <form
      key={applied}
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get("search");
        apply(typeof value === "string" ? value.trim() : undefined);
      }}
    >
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary"
        aria-hidden
      />
      <Input
        name="search"
        defaultValue={applied}
        placeholder="Buscar por nombre, apellido, DNI, teléfono o email…"
        aria-label="Buscar clientes"
        className="pl-10 pr-10"
      />
      {applied ? (
        <button
          type="button"
          onClick={() => apply(undefined)}
          aria-label="Limpiar búsqueda"
          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-tertiary hover:text-fg"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </form>
  );
}
