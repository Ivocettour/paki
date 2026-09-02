"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Ban, Minus, Pencil, Plus, Search, X } from "lucide-react";
import { AccessoryCategory } from "@prisma/client";
import {
  adjustStockAction,
  createAccessoryAction,
  deactivateAccessoryAction,
  updateAccessoryAction,
} from "@/lib/actions/accessories";
import { ACCESSORY_CATEGORY_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/field";

interface AccessoryValues {
  id: string;
  category: AccessoryCategory;
  name: string;
  brand: string | null;
  sku: string | null;
  salePrice: number;
  minStock: number;
  stockQuantity: number;
  isActive: boolean;
}

function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[12px] bg-danger-soft px-3.5 py-3 text-[13px] text-danger"
    >
      <AlertCircle className="size-4 shrink-0 mt-px" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

/// Alta y edición. En el alta se puede cargar el stock inicial de una vez.
function AccessoryDialog({
  open,
  onClose,
  accessory,
}: {
  open: boolean;
  onClose: () => void;
  accessory?: AccessoryValues;
}) {
  const router = useRouter();
  const isEdit = Boolean(accessory);

  const [category, setCategory] = useState<AccessoryCategory>(
    accessory?.category ?? AccessoryCategory.FUNDA,
  );
  const [name, setName] = useState(accessory?.name ?? "");
  const [brand, setBrand] = useState(accessory?.brand ?? "");
  const [sku, setSku] = useState(accessory?.sku ?? "");
  const [salePrice, setSalePrice] = useState(String(accessory?.salePrice ?? ""));
  const [minStock, setMinStock] = useState(String(accessory?.minStock ?? 0));
  const [initialStock, setInitialStock] = useState("0");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    const payload = {
      category,
      name,
      brand,
      sku,
      salePrice: Number(salePrice),
      minStock: Number(minStock) || 0,
      notes,
      ...(isEdit ? {} : { initialStock: Number(initialStock) || 0 }),
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateAccessoryAction(accessory!.id, payload)
        : await createAccessoryAction(payload);

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success(isEdit ? "Accesorio actualizado" : "Accesorio creado");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar accesorio" : "Nuevo accesorio"}
      description={
        isEdit
          ? "El stock no se edita acá: se mueve con un ajuste, para que quede registrado."
          : "Se maneja por cantidad. Podés cargar el stock inicial ahora."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            loading={isPending}
            disabled={!name.trim() || salePrice === ""}
            onClick={handleSubmit}
          >
            {isEdit ? "Guardar cambios" : "Crear accesorio"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBanner message={error} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rubro" htmlFor="category" required error={fieldErrors.category?.[0]}>
            <Select
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as AccessoryCategory)}
            >
              {Object.values(AccessoryCategory).map((value) => (
                <option key={value} value={value}>
                  {ACCESSORY_CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Marca" htmlFor="brand" error={fieldErrors.brand?.[0]}>
            <Input
              id="brand"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              placeholder="Opcional"
            />
          </Field>

          <Field
            label="Nombre"
            htmlFor="name"
            required
            error={fieldErrors.name?.[0]}
            className="sm:col-span-2"
          >
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej.: Funda silicona iPhone 15 negra"
            />
          </Field>

          <Field label="Precio de venta" htmlFor="salePrice" required error={fieldErrors.salePrice?.[0]}>
            <Input
              id="salePrice"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={salePrice}
              onChange={(event) => setSalePrice(event.target.value)}
            />
          </Field>

          <Field
            label="Stock mínimo"
            htmlFor="minStock"
            error={fieldErrors.minStock?.[0]}
            hint="0 = sin alerta"
          >
            <Input
              id="minStock"
              type="number"
              inputMode="numeric"
              min={0}
              value={minStock}
              onChange={(event) => setMinStock(event.target.value)}
            />
          </Field>

          {!isEdit ? (
            <Field
              label="Stock inicial"
              htmlFor="initialStock"
              error={fieldErrors.initialStock?.[0]}
              hint="Queda registrado como ingreso."
            >
              <Input
                id="initialStock"
                type="number"
                inputMode="numeric"
                min={0}
                value={initialStock}
                onChange={(event) => setInitialStock(event.target.value)}
              />
            </Field>
          ) : null}

          <Field label="Código interno" htmlFor="sku" error={fieldErrors.sku?.[0]}>
            <Input
              id="sku"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="Opcional"
            />
          </Field>

          <Field
            label="Observaciones"
            htmlFor="accessoryNotes"
            className="sm:col-span-2"
            error={fieldErrors.notes?.[0]}
          >
            <Textarea
              id="accessoryNotes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

export function NewAccessoryButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Nuevo accesorio
      </Button>
      <AccessoryDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AccessoryRowActions({
  accessory,
  canEdit,
  canAdjust,
  canDeactivate,
}: {
  accessory: AccessoryValues;
  canEdit: boolean;
  canAdjust: boolean;
  canDeactivate: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdjust() {
    setError(null);

    startTransition(async () => {
      const result = await adjustStockAction(accessory.id, {
        quantityDelta: Number(delta),
        reason,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Stock ajustado", {
        description: `${accessory.name}: ${Number(delta) > 0 ? "+" : ""}${delta} unidades.`,
      });
      setAdjustOpen(false);
      setReason("");
      setDelta("1");
      router.refresh();
    });
  }

  function handleDeactivate() {
    setError(null);

    startTransition(async () => {
      const result = await deactivateAccessoryAction(accessory.id, reason);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Accesorio dado de baja", {
        description: "Conserva su historial de movimientos y ventas.",
      });
      setDeactivateOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {canAdjust && accessory.isActive ? (
          <button
            type="button"
            onClick={() => setAdjustOpen(true)}
            aria-label={`Ajustar stock de ${accessory.name}`}
            className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-subtle hover:text-fg"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        ) : null}

        {canEdit ? (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label={`Editar ${accessory.name}`}
            className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-subtle hover:text-fg"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        ) : null}

        {canDeactivate && accessory.isActive ? (
          <button
            type="button"
            onClick={() => setDeactivateOpen(true)}
            aria-label={`Dar de baja ${accessory.name}`}
            className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Ban className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {editOpen ? (
        <AccessoryDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          accessory={accessory}
        />
      ) : null}

      <Dialog
        open={adjustOpen}
        onClose={() => {
          setAdjustOpen(false);
          setError(null);
        }}
        title="Ajustar stock"
        description={`${accessory.name} · stock actual: ${accessory.stockQuantity}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              loading={isPending}
              disabled={reason.trim().length < 3 || Number(delta) === 0 || delta === ""}
              onClick={handleAdjust}
            >
              Registrar ajuste
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ErrorBanner message={error} />

          <div>
            <Label htmlFor="delta" required>
              Cantidad
            </Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Restar una unidad"
                onClick={() => setDelta(String(Number(delta) - 1))}
              >
                <Minus className="size-4" aria-hidden />
              </Button>
              <Input
                id="delta"
                type="number"
                inputMode="numeric"
                value={delta}
                onChange={(event) => setDelta(event.target.value)}
                className="text-center"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label="Sumar una unidad"
                onClick={() => setDelta(String(Number(delta) + 1))}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </div>
            <p className="mt-1.5 text-[13px] text-fg-tertiary">
              Positivo para ingresar stock, negativo para descontarlo. Queda en{" "}
              <span className="tabular font-medium text-fg">
                {accessory.stockQuantity + (Number(delta) || 0)}
              </span>
              .
            </p>
          </div>

          <Field label="Motivo" htmlFor="adjustReason" required>
            <Textarea
              id="adjustReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej.: ingreso de mercadería del proveedor."
            />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={deactivateOpen}
        onClose={() => {
          setDeactivateOpen(false);
          setError(null);
        }}
        title="Dar de baja el accesorio"
        description="Deja de ofrecerse en las ventas. No se elimina: conserva su historial."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeactivateOpen(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={isPending}
              disabled={reason.trim().length < 3}
              onClick={handleDeactivate}
            >
              Dar de baja
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <ErrorBanner message={error} />
          <Field label="Motivo de la baja" htmlFor="deactivateReason" required>
            <Textarea
              id="deactivateReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Ej.: se discontinuó el producto."
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

export function AccessoryFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const applied = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const includeInactive = searchParams.get("includeInactive") === "true";

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    startTransition(() => router.push(`/accesorios?${params.toString()}`));
  }

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <form
        key={applied}
        className="relative flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get("search");
          apply({ search: typeof value === "string" ? value.trim() : undefined });
        }}
      >
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary"
          aria-hidden
        />
        <Input
          name="search"
          defaultValue={applied}
          placeholder="Buscar por nombre, marca o código…"
          aria-label="Buscar accesorios"
          className="pl-10 pr-10"
        />
        {applied ? (
          <button
            type="button"
            onClick={() => apply({ search: undefined })}
            aria-label="Limpiar búsqueda"
            className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-tertiary hover:text-fg"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </form>

      <div className="w-full sm:w-56">
        <Label htmlFor="categoryFilter">Rubro</Label>
        <Select
          id="categoryFilter"
          className="mt-1.5"
          value={category}
          onChange={(event) => apply({ category: event.target.value })}
        >
          <option value="">Todos</option>
          {Object.values(AccessoryCategory).map((value) => (
            <option key={value} value={value}>
              {ACCESSORY_CATEGORY_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      <label className="flex items-center gap-2 pb-2.5 text-[13px] text-fg-secondary">
        <input
          type="checkbox"
          className="size-4 rounded border-line accent-[var(--accent)]"
          checked={includeInactive}
          onChange={(event) =>
            apply({ includeInactive: event.target.checked ? "true" : undefined })
          }
        />
        Ver dados de baja
      </label>
    </div>
  );
}
