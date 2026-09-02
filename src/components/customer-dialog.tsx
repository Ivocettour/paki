"use client";

import { useState, useTransition } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { createCustomerAction, updateCustomerAction } from "@/lib/actions/customers";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";

export interface CustomerValues {
  id: string;
  firstName: string;
  lastName: string;
  dni: string | null;
  phone: string | null;
  email?: string | null;
  notes?: string | null;
}

/**
 * Alta y edición de clientes.
 *
 * Se usa tanto desde la sección Clientes como desde el formulario de venta,
 * para no obligar a abandonar la venta a mitad de camino.
 */
export function CustomerDialog({
  open,
  onClose,
  onCreated,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (customer: CustomerValues) => void;
  customer?: CustomerValues;
}) {
  const isEdit = Boolean(customer);

  const [firstName, setFirstName] = useState(customer?.firstName ?? "");
  const [lastName, setLastName] = useState(customer?.lastName ?? "");
  const [dni, setDni] = useState(customer?.dni ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function reset() {
    setFirstName("");
    setLastName("");
    setDni("");
    setPhone("");
    setEmail("");
    setNotes("");
    setError(null);
    setFieldErrors({});
  }

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    const payload = { firstName, lastName, dni, phone, email, notes };

    startTransition(async () => {
      const result = isEdit
        ? await updateCustomerAction(customer!.id, payload)
        : await createCustomerAction(payload);

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success(isEdit ? "Cliente actualizado" : "Cliente creado");

      if (!isEdit && onCreated) {
        onCreated({
          id: (result.data as { id: string }).id,
          firstName,
          lastName,
          dni: dni || null,
          phone: phone || null,
        });
      }

      reset();
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar cliente" : "Nuevo cliente"}
      description="Solo el nombre y el apellido son obligatorios."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            loading={isPending}
            disabled={!firstName.trim() || !lastName.trim()}
            onClick={handleSubmit}
          >
            {isEdit ? "Guardar cambios" : "Crear cliente"}
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
            htmlFor="firstName"
            required
            error={fieldErrors.firstName?.[0]}
          >
            <Input
              id="firstName"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </Field>

          <Field
            label="Apellido"
            htmlFor="lastName"
            required
            error={fieldErrors.lastName?.[0]}
          >
            <Input
              id="lastName"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>

          <Field label="DNI" htmlFor="dni" error={fieldErrors.dni?.[0]}>
            <Input
              id="dni"
              inputMode="numeric"
              value={dni}
              onChange={(event) => setDni(event.target.value)}
              placeholder="Sin puntos"
            />
          </Field>

          <Field label="Teléfono" htmlFor="phone" error={fieldErrors.phone?.[0]}>
            <Input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>

          <Field
            label="Email"
            htmlFor="email"
            error={fieldErrors.email?.[0]}
            className="sm:col-span-2"
          >
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field
            label="Observaciones"
            htmlFor="customerNotes"
            error={fieldErrors.notes?.[0]}
            className="sm:col-span-2"
          >
            <Textarea
              id="customerNotes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
