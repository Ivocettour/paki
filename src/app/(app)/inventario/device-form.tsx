"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { DeviceCondition, InventoryStatus } from "@prisma/client";
import {
  deviceFormSchema,
  type DeviceFormInput,
  type DeviceFormValues,
} from "@/lib/validations/device";
import { createDeviceAction, updateDeviceAction } from "@/lib/actions/devices";
import type { Catalog } from "@/lib/services/devices";
import {
  DEVICE_CONDITION_LABELS,
  INVENTORY_STATUS_LABELS,
  STORAGE_OPTIONS_GB,
  formatStorage,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { toDateInputValue } from "@/lib/utils";

type FormValues = DeviceFormInput;

export function DeviceForm({
  catalog,
  mode,
  deviceId,
  canEditPrice,
  canSeePurchasePrice,
  canManageCatalog,
  defaultValues,
}: {
  catalog: Catalog;
  mode: "create" | "edit";
  deviceId?: string;
  canEditPrice: boolean;
  canSeePurchasePrice: boolean;
  canManageCatalog: boolean;
  defaultValues?: Partial<FormValues>;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<FormValues, unknown, DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: {
      modelId: "",
      color: "",
      condition: DeviceCondition.NUEVO_SELLADO,
      requiresImei: true,
      entryDate: new Date(),
      batteryPercent: null,
      purchasePrice: null,
      ...defaultValues,
    },
  });

  // `useWatch` en lugar de `watch()`: es la API suscribible y segura para
  // memoización, y evita re-renderizar todo el formulario en cada tecla.
  const condition = useWatch({ control, name: "condition" });
  const requiresImei = useWatch({ control, name: "requiresImei" });
  const batteryRequired = condition === DeviceCondition.USADO;

  function onSubmit(values: DeviceFormValues) {
    setFormError(null);

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createDeviceAction(values)
          : await updateDeviceAction(deviceId!, values);

      if (!result.ok) {
        // Los errores por campo del servidor se reflejan en el formulario.
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) {
              setError(field as keyof FormValues, { message: messages[0] });
            }
          }
        }
        setFormError(result.error);
        return;
      }

      toast.success(
        mode === "create" ? "Equipo registrado" : "Cambios guardados",
        {
          description:
            mode === "create"
              ? "El equipo quedó disponible en el inventario."
              : "Las modificaciones quedaron registradas en la auditoría.",
        },
      );

      const targetId = mode === "create" ? (result.data as { id: string }).id : deviceId!;
      router.push(`/inventario/${targetId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[14px] bg-danger-soft px-4 py-3 text-[14px] text-danger"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
          <span>{formError}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Información general" />
        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Modelo"
            htmlFor="modelId"
            required
            error={errors.modelId?.message}
            className="sm:col-span-2"
          >
            <Select id="modelId" aria-invalid={Boolean(errors.modelId)} {...register("modelId")}>
              <option value="">Seleccioná un modelo…</option>
              {catalog.map((brand) => (
                <optgroup key={brand.id} label={brand.name}>
                  {brand.models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {brand.name} {model.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            {/* Sin esta salida, un modelo nuevo obliga a abandonar el formulario. */}
            {canManageCatalog ? (
              <p className="text-[13px] text-fg-tertiary">
                ¿No está el modelo?{" "}
                <Link
                  href="/configuracion"
                  className="text-accent hover:underline"
                  target="_blank"
                >
                  Agregalo al catálogo
                </Link>{" "}
                y volvé a esta pantalla.
              </p>
            ) : null}
          </Field>

          <Field label="Color" htmlFor="color" required error={errors.color?.message}>
            <Input
              id="color"
              placeholder="Ej.: Negro"
              aria-invalid={Boolean(errors.color)}
              {...register("color")}
            />
          </Field>

          <Field
            label="Capacidad"
            htmlFor="storageGb"
            required
            error={errors.storageGb?.message}
          >
            <Select
              id="storageGb"
              aria-invalid={Boolean(errors.storageGb)}
              {...register("storageGb", { valueAsNumber: true })}
            >
              <option value="">Seleccioná…</option>
              {STORAGE_OPTIONS_GB.map((gb) => (
                <option key={gb} value={gb}>
                  {formatStorage(gb)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Estado del equipo"
            htmlFor="condition"
            required
            error={errors.condition?.message}
          >
            <Select id="condition" {...register("condition")}>
              {Object.values(DeviceCondition).map((value) => (
                <option key={value} value={value}>
                  {DEVICE_CONDITION_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Batería (%)"
            htmlFor="batteryPercent"
            required={batteryRequired}
            error={errors.batteryPercent?.message}
            hint={
              batteryRequired
                ? "Obligatorio para equipos usados."
                : "Opcional en equipos nuevos."
            }
          >
            <Controller
              control={control}
              name="batteryPercent"
              render={({ field }) => (
                <Input
                  id="batteryPercent"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  placeholder="0 a 100"
                  aria-invalid={Boolean(errors.batteryPercent)}
                  value={field.value ?? ""}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === "" ? null : Number(event.target.value),
                    )
                  }
                />
              )}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Identificación"
          description="El IMEI es obligatorio para celulares y no puede repetirse."
        />
        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="IMEI"
            htmlFor="imei"
            required={requiresImei}
            error={errors.imei?.message}
          >
            <Input
              id="imei"
              inputMode="numeric"
              placeholder="15 dígitos"
              aria-invalid={Boolean(errors.imei)}
              {...register("imei")}
            />
          </Field>

          <Field
            label="Número de serie"
            htmlFor="serialNumber"
            error={errors.serialNumber?.message}
          >
            <Input id="serialNumber" placeholder="Opcional" {...register("serialNumber")} />
          </Field>

          <label className="flex items-start gap-2.5 sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-line accent-[var(--accent)]"
              {...register("requiresImei")}
            />
            <span className="text-[13px] text-fg-secondary">
              Este producto requiere IMEI.{" "}
              <span className="text-fg-tertiary">
                Desmarcalo solo para accesorios u otros productos sin IMEI.
              </span>
            </span>
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Información económica" />
        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {canSeePurchasePrice ? (
            <Field
              label="Precio de compra"
              htmlFor="purchasePrice"
              error={errors.purchasePrice?.message}
              hint="Opcional."
            >
              <Controller
                control={control}
                name="purchasePrice"
                render={({ field }) => (
                  <Input
                    id="purchasePrice"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={field.value ?? ""}
                    onChange={(event) =>
                      field.onChange(
                        event.target.value === "" ? null : Number(event.target.value),
                      )
                    }
                  />
                )}
              />
            </Field>
          ) : null}

          <Field
            label="Precio de venta"
            htmlFor="salePrice"
            required
            error={errors.salePrice?.message}
            hint={canEditPrice ? undefined : "No tenés permisos para modificar el precio."}
          >
            <Input
              id="salePrice"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="0"
              disabled={!canEditPrice}
              aria-invalid={Boolean(errors.salePrice)}
              {...register("salePrice", { valueAsNumber: true })}
            />
          </Field>

          <Field
            label="Fecha de ingreso"
            htmlFor="entryDate"
            required
            error={errors.entryDate?.message}
          >
            <Controller
              control={control}
              name="entryDate"
              render={({ field }) => (
                <Input
                  id="entryDate"
                  type="date"
                  // `entryDate` se coacciona en el esquema, por eso su tipo de
                  // entrada es amplio; acá solo aceptamos Date o string ISO.
                  value={
                    field.value instanceof Date || typeof field.value === "string"
                      ? toDateInputValue(field.value)
                      : ""
                  }
                  onChange={(event) => field.onChange(new Date(event.target.value))}
                />
              )}
            />
          </Field>

          {mode === "edit" ? (
            <Field
              label="Estado de inventario"
              htmlFor="inventoryStatus"
              required
              error={errors.inventoryStatus?.message}
            >
              <Select id="inventoryStatus" {...register("inventoryStatus")}>
                {Object.values(InventoryStatus).map((value) => (
                  <option key={value} value={value}>
                    {INVENTORY_STATUS_LABELS[value]}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <Field
            label="Observaciones"
            htmlFor="notes"
            error={errors.notes?.message}
            className="sm:col-span-2"
          >
            <Textarea id="notes" placeholder="Opcional" {...register("notes")} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2.5 pb-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" loading={isPending}>
          {mode === "create" ? "Registrar equipo" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
