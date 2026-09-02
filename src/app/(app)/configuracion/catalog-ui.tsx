"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createBrandAction,
  createModelAction,
  deleteBrandAction,
  deleteModelAction,
  updateBrandAction,
  updateModelAction,
} from "@/lib/actions/catalog";
import type { CatalogBrand, CatalogModel } from "@/lib/services/catalog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";

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

function BrandDialog({
  open,
  onClose,
  brand,
}: {
  open: boolean;
  onClose: () => void;
  brand?: { id: string; name: string };
}) {
  const router = useRouter();
  const isEdit = Boolean(brand);

  const [name, setName] = useState(brand?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = isEdit
        ? await updateBrandAction(brand!.id, { name })
        : await createBrandAction({ name });

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success(isEdit ? "Marca actualizada" : "Marca creada");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar marca" : "Nueva marca"}
      description={
        isEdit
          ? "Cambiar el nombre lo actualiza en todos los equipos de esta marca."
          : "Ej.: Apple, Samsung, Xiaomi."
      }
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button loading={isPending} disabled={name.trim().length < 2} onClick={handleSubmit}>
            {isEdit ? "Guardar" : "Crear marca"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBanner message={error} />
        <Field label="Nombre" htmlFor="brandName" required error={fieldErrors.name?.[0]}>
          <Input
            id="brandName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </Field>
      </div>
    </Dialog>
  );
}

function ModelDialog({
  open,
  onClose,
  brandId,
  brandName,
  model,
}: {
  open: boolean;
  onClose: () => void;
  brandId: string;
  brandName: string;
  model?: CatalogModel;
}) {
  const router = useRouter();
  const isEdit = Boolean(model);

  const [name, setName] = useState(model?.name ?? "");
  const [minStock, setMinStock] = useState(String(model?.minStock ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    const payload = { brandId, name, minStock: Number(minStock) || 0 };

    startTransition(async () => {
      const result = isEdit
        ? await updateModelAction(model!.id, payload)
        : await createModelAction(payload);

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success(isEdit ? "Modelo actualizado" : "Modelo creado");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar modelo" : `Nuevo modelo de ${brandName}`}
      description={
        isEdit
          ? "El modelo no se puede mover de marca: los equipos ya cargados quedarían mal atribuidos."
          : "Ej.: iPhone 16, Galaxy S25."
      }
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button loading={isPending} disabled={name.trim().length < 1} onClick={handleSubmit}>
            {isEdit ? "Guardar" : "Crear modelo"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBanner message={error} />

        <Field label="Nombre del modelo" htmlFor="modelName" required error={fieldErrors.name?.[0]}>
          <Input
            id="modelName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </Field>

        <Field
          label="Stock mínimo"
          htmlFor="modelMinStock"
          error={fieldErrors.minStock?.[0]}
          hint="Avisa en el dashboard cuando quedan menos unidades. En 0 no avisa."
        >
          <Input
            id="modelMinStock"
            type="number"
            inputMode="numeric"
            min={0}
            value={minStock}
            onChange={(event) => setMinStock(event.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

function DeleteDialog({
  open,
  onClose,
  title,
  description,
  onConfirm,
  isPending,
  error,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onConfirm: () => void;
  isPending: boolean;
  error: string | null;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="danger" loading={isPending} onClick={onConfirm}>
            Eliminar
          </Button>
        </>
      }
    >
      <ErrorBanner message={error} />
    </Dialog>
  );
}

export function NewBrandButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Nueva marca
      </Button>
      {open ? <BrandDialog open={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function BrandSection({
  brand,
  canManage,
}: {
  brand: CatalogBrand;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [newModelOpen, setNewModelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);

    startTransition(async () => {
      const result = await deleteBrandAction(brand.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Marca eliminada");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={brand.name}
        description={`${brand.models.length} ${
          brand.models.length === 1 ? "modelo" : "modelos"
        } · ${brand.deviceCount} ${
          brand.deviceCount === 1 ? "equipo cargado" : "equipos cargados"
        }`}
        action={
          canManage ? (
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="sm" onClick={() => setNewModelOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Modelo
              </Button>
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                aria-label={`Editar la marca ${brand.name}`}
                className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-subtle hover:text-fg"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              {brand.canDelete ? (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  aria-label={`Eliminar la marca ${brand.name}`}
                  className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null
        }
      />

      {brand.models.length === 0 ? (
        <div className="px-5 py-6 text-center text-[13px] text-fg-tertiary">
          Esta marca todavía no tiene modelos.
        </div>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {brand.models.map((model) => (
            <ModelRow
              key={model.id}
              model={model}
              brandId={brand.id}
              brandName={brand.name}
              canManage={canManage}
            />
          ))}
        </ul>
      )}

      {editOpen ? (
        <BrandDialog open={editOpen} onClose={() => setEditOpen(false)} brand={brand} />
      ) : null}

      {newModelOpen ? (
        <ModelDialog
          open={newModelOpen}
          onClose={() => setNewModelOpen(false)}
          brandId={brand.id}
          brandName={brand.name}
        />
      ) : null}

      <DeleteDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setError(null);
        }}
        title={`Eliminar ${brand.name}`}
        description="La marca no tiene modelos asociados, así que se puede eliminar sin perder historial."
        onConfirm={handleDelete}
        isPending={isPending}
        error={error}
      />
    </Card>
  );
}

function ModelRow({
  model,
  brandId,
  brandName,
  canManage,
}: {
  model: CatalogModel;
  brandId: string;
  brandName: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isLowStock = model.minStock > 0 && model.availableCount < model.minStock;

  function handleDelete() {
    setError(null);

    startTransition(async () => {
      const result = await deleteModelAction(model.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Modelo eliminado");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-4 px-5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-fg">{model.name}</p>
        <p className="text-[12px] text-fg-tertiary">
          {model.availableCount} disponibles de {model.deviceCount} cargados
          {model.minStock > 0 ? ` · mínimo ${model.minStock}` : " · sin alerta de stock"}
        </p>
      </div>

      {isLowStock ? <Badge tone="warning">Stock bajo</Badge> : null}

      {canManage ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label={`Editar el modelo ${model.name}`}
            className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-subtle hover:text-fg"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          {model.canDelete ? (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              aria-label={`Eliminar el modelo ${model.name}`}
              className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      {editOpen ? (
        <ModelDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          brandId={brandId}
          brandName={brandName}
          model={model}
        />
      ) : null}

      <DeleteDialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setError(null);
        }}
        title={`Eliminar ${model.name}`}
        description="Nunca se usó, así que se puede eliminar sin perder historial."
        onConfirm={handleDelete}
        isPending={isPending}
        error={error}
      />
    </li>
  );
}
