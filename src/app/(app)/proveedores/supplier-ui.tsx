"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Pencil, Plus, Search, X } from "lucide-react";
import { createSupplierAction, updateSupplierAction } from "@/lib/actions/purchases";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";

interface SupplierValues {
  id: string;
  name: string;
  cuit: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes?: string | null;
}

function SupplierDialog({
  open,
  onClose,
  supplier,
}: {
  open: boolean;
  onClose: () => void;
  supplier?: SupplierValues;
}) {
  const router = useRouter();
  const isEdit = Boolean(supplier);

  const [name, setName] = useState(supplier?.name ?? "");
  const [cuit, setCuit] = useState(supplier?.cuit ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [notes, setNotes] = useState(supplier?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    const payload = { name, cuit, phone, email, address, notes };

    startTransition(async () => {
      const result = isEdit
        ? await updateSupplierAction(supplier!.id, payload)
        : await createSupplierAction(payload);

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success(isEdit ? "Proveedor actualizado" : "Proveedor creado");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar proveedor" : "Nuevo proveedor"}
      description="Solo el nombre es obligatorio."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button loading={isPending} disabled={name.trim().length < 2} onClick={handleSubmit}>
            {isEdit ? "Guardar cambios" : "Crear proveedor"}
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Nombre"
            htmlFor="name"
            required
            error={fieldErrors.name?.[0]}
            className="sm:col-span-2"
          >
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>

          <Field label="CUIT" htmlFor="cuit" error={fieldErrors.cuit?.[0]}>
            <Input
              id="cuit"
              value={cuit}
              onChange={(event) => setCuit(event.target.value)}
              placeholder="30-71234567-9"
            />
          </Field>

          <Field label="Teléfono" htmlFor="phone" error={fieldErrors.phone?.[0]}>
            <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>

          <Field label="Email" htmlFor="email" error={fieldErrors.email?.[0]}>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Dirección" htmlFor="address" error={fieldErrors.address?.[0]}>
            <Input
              id="address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </Field>

          <Field
            label="Observaciones"
            htmlFor="supplierNotes"
            error={fieldErrors.notes?.[0]}
            className="sm:col-span-2"
          >
            <Textarea
              id="supplierNotes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

export function NewSupplierButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Nuevo proveedor
      </Button>
      {open ? <SupplierDialog open={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function SupplierRowActions({ supplier }: { supplier: SupplierValues }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Editar ${supplier.name}`}
        className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-subtle hover:text-fg"
      >
        <Pencil className="size-4" aria-hidden />
      </button>

      {open ? (
        <SupplierDialog open={open} onClose={() => setOpen(false)} supplier={supplier} />
      ) : null}
    </>
  );
}

export function SupplierSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const applied = searchParams.get("search") ?? "";

  function apply(value?: string) {
    const params = new URLSearchParams();
    if (value) params.set("search", value);
    startTransition(() => router.push(`/proveedores?${params.toString()}`));
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
        placeholder="Buscar por nombre, CUIT o email…"
        aria-label="Buscar proveedores"
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
