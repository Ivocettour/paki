"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { AccessoryCategory, DeviceCondition, DeviceType } from "@prisma/client";
import { createPurchaseAction } from "@/lib/actions/purchases";
import {
  ACCESSORY_CATEGORY_LABELS,
  DEVICE_CONDITION_LABELS,
  DEVICE_TYPE_FIELDS,
  DEVICE_TYPE_LABELS,
  STORAGE_OPTIONS_GB,
  formatStorage,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/field";
import { formatCurrency, toDateInputValue } from "@/lib/utils";

interface Catalog {
  id: string;
  name: string;
  models: Array<{ id: string; name: string }>;
}

interface AccessoryOption {
  id: string;
  name: string;
  category: AccessoryCategory;
  stockQuantity: number;
  salePrice: number;
}

/// Ítem en edición dentro del formulario. Se envía convertido al schema.
interface DeviceLine {
  key: string;
  kind: "equipo";
  modelId: string;
  deviceType: DeviceType;
  color: string;
  storageGb: string;
  condition: DeviceCondition;
  batteryPercent: string;
  imei: string;
  serialNumber: string;
  unitCost: string;
  salePrice: string;
}

interface AccessoryLine {
  key: string;
  kind: "accesorio";
  accessoryId: string;
  quantity: string;
  unitCost: string;
}

type Line = DeviceLine | AccessoryLine;

function newKey(): string {
  return Math.random().toString(36).slice(2);
}

function emptyDevice(): DeviceLine {
  return {
    key: newKey(),
    kind: "equipo",
    modelId: "",
    deviceType: DeviceType.CELULAR,
    color: "",
    storageGb: "",
    condition: DeviceCondition.NUEVO_SELLADO,
    batteryPercent: "",
    imei: "",
    serialNumber: "",
    unitCost: "",
    salePrice: "",
  };
}

function emptyAccessory(): AccessoryLine {
  return { key: newKey(), kind: "accesorio", accessoryId: "", quantity: "1", unitCost: "" };
}

export function PurchaseForm({
  suppliers,
  catalog,
  accessories,
}: {
  suppliers: Array<{ id: string; name: string }>;
  catalog: Catalog[];
  accessories: AccessoryOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(toDateInputValue(new Date()));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyDevice()]);

  const total = lines.reduce((sum, line) => {
    const cost = Number(line.unitCost) || 0;
    const quantity = line.kind === "accesorio" ? Number(line.quantity) || 0 : 1;
    return sum + cost * quantity;
  }, 0);

  /// Genérico por tipo de línea: un parche de equipo no puede aplicarse a un
  /// accesorio ni al revés.
  function updateLine<T extends Line>(key: string, patch: Partial<T>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? ({ ...line, ...patch } as Line) : line)),
    );
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  const canSubmit =
    supplierId !== "" &&
    lines.length > 0 &&
    lines.every((line) =>
      line.kind === "equipo"
        ? line.modelId && line.color.trim() && line.unitCost !== "" && line.salePrice !== ""
        : line.accessoryId && Number(line.quantity) > 0 && line.unitCost !== "",
    );

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Se traduce el estado del formulario al formato que espera el servidor.
    const items = lines.map((line) =>
      line.kind === "equipo"
        ? {
            kind: "equipo" as const,
            modelId: line.modelId,
            deviceType: line.deviceType,
            color: line.color,
            storageGb: line.storageGb ? Number(line.storageGb) : null,
            condition: line.condition,
            batteryPercent: line.batteryPercent ? Number(line.batteryPercent) : null,
            imei: line.imei,
            serialNumber: line.serialNumber,
            unitCost: Number(line.unitCost),
            salePrice: Number(line.salePrice),
          }
        : {
            kind: "accesorio" as const,
            accessoryId: line.accessoryId,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost),
          },
    );

    startTransition(async () => {
      const result = await createPurchaseAction({
        supplierId,
        purchaseDate: new Date(purchaseDate),
        notes,
        items,
      });

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      toast.success(`Compra ${result.data.purchaseNumber} registrada`, {
        description: "Queda en borrador: confirmala para ingresar la mercadería.",
      });

      router.push(`/compras/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <CardHeader title="Datos de la compra" />
        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Proveedor" htmlFor="supplierId" required>
            <Select
              id="supplierId"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">Seleccioná un proveedor…</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Fecha de la compra" htmlFor="purchaseDate" required>
            <Input
              id="purchaseDate"
              type="date"
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
            />
          </Field>

          <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opcional. Ej.: número de remito del proveedor."
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Mercadería"
          description="Los equipos se cargan de a uno; los accesorios, por cantidad."
          action={
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setLines((current) => [...current, emptyDevice()])}
              >
                <Plus className="size-4" aria-hidden />
                Equipo
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={accessories.length === 0}
                onClick={() => setLines((current) => [...current, emptyAccessory()])}
              >
                <Plus className="size-4" aria-hidden />
                Accesorio
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          {accessories.length === 0 ? (
            <p className="rounded-[12px] bg-surface-subtle px-4 py-3 text-[13px] text-fg-secondary">
              Todavía no hay accesorios cargados. Creálos primero en la sección
              Accesorios y después vas a poder reponerlos desde una compra.
            </p>
          ) : null}

          {lines.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-tertiary">
              Agregá al menos un equipo o accesorio.
            </p>
          ) : null}

          {lines.map((line, index) =>
            line.kind === "equipo" ? (
              <DeviceLineFields
                key={line.key}
                line={line}
                index={index}
                catalog={catalog}
                onChange={(patch) => updateLine(line.key, patch)}
                onRemove={() => removeLine(line.key)}
              />
            ) : (
              <AccessoryLineFields
                key={line.key}
                line={line}
                index={index}
                accessories={accessories}
                onChange={(patch) => updateLine(line.key, patch)}
                onRemove={() => removeLine(line.key)}
              />
            ),
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex items-baseline justify-between">
          <span className="text-[15px] font-medium text-fg">
            Total de la compra ({lines.length} {lines.length === 1 ? "ítem" : "ítems"})
          </span>
          <span className="tabular text-[26px] font-semibold tracking-[-0.03em] text-fg">
            {formatCurrency(total)}
          </span>
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2.5 pb-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" loading={isPending} disabled={!canSubmit}>
          Registrar compra
        </Button>
      </div>
    </form>
  );
}

function LineWrapper({
  title,
  index,
  onRemove,
  children,
}: {
  title: string;
  index: number;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-line-subtle p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] font-medium text-fg-secondary">
          {index + 1}. {title}
        </p>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar ítem ${index + 1}`}
          className="grid size-8 place-items-center rounded-full text-fg-tertiary hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      {children}
    </div>
  );
}

function DeviceLineFields({
  line,
  index,
  catalog,
  onChange,
  onRemove,
}: {
  line: DeviceLine;
  index: number;
  catalog: Catalog[];
  onChange: (patch: Partial<DeviceLine>) => void;
  onRemove: () => void;
}) {
  // Qué campos aplican depende del tipo: un parlante no tiene IMEI ni batería.
  const fields = DEVICE_TYPE_FIELDS[line.deviceType];
  const batteryRequired = fields.battery && line.condition === DeviceCondition.USADO;

  return (
    <LineWrapper title="Equipo" index={index} onRemove={onRemove}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`type-${line.key}`} required>
            Tipo
          </Label>
          <Select
            id={`type-${line.key}`}
            value={line.deviceType}
            onChange={(event) =>
              onChange({ deviceType: event.target.value as DeviceType })
            }
          >
            {Object.values(DeviceType).map((type) => (
              <option key={type} value={type}>
                {DEVICE_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor={`model-${line.key}`} required>
            Modelo
          </Label>
          <Select
            id={`model-${line.key}`}
            value={line.modelId}
            onChange={(event) => onChange({ modelId: event.target.value })}
          >
            <option value="">Seleccioná…</option>
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
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`color-${line.key}`} required>
            Color
          </Label>
          <Input
            id={`color-${line.key}`}
            value={line.color}
            onChange={(event) => onChange({ color: event.target.value })}
            placeholder="Ej.: Negro"
          />
        </div>

        {fields.storage ? (
          <div className="space-y-1.5">
            <Label htmlFor={`storage-${line.key}`}>Capacidad</Label>
            <Select
              id={`storage-${line.key}`}
              value={line.storageGb}
              onChange={(event) => onChange({ storageGb: event.target.value })}
            >
              <option value="">Sin especificar</option>
              {STORAGE_OPTIONS_GB.map((gb) => (
                <option key={gb} value={gb}>
                  {formatStorage(gb)}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor={`condition-${line.key}`} required>
            Estado
          </Label>
          <Select
            id={`condition-${line.key}`}
            value={line.condition}
            onChange={(event) =>
              onChange({ condition: event.target.value as DeviceCondition })
            }
          >
            {Object.values(DeviceCondition).map((condition) => (
              <option key={condition} value={condition}>
                {DEVICE_CONDITION_LABELS[condition]}
              </option>
            ))}
          </Select>
        </div>

        {fields.battery ? (
          <div className="space-y-1.5">
            <Label htmlFor={`battery-${line.key}`} required={batteryRequired}>
              Batería (%)
            </Label>
            <Input
              id={`battery-${line.key}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={line.batteryPercent}
              onChange={(event) => onChange({ batteryPercent: event.target.value })}
              placeholder={batteryRequired ? "Obligatorio en usados" : "Opcional"}
            />
          </div>
        ) : null}

        {fields.imei ? (
          <div className="space-y-1.5">
            <Label htmlFor={`imei-${line.key}`}>IMEI</Label>
            <Input
              id={`imei-${line.key}`}
              inputMode="numeric"
              value={line.imei}
              onChange={(event) => onChange({ imei: event.target.value })}
              placeholder="15 dígitos"
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor={`serial-${line.key}`}>Número de serie</Label>
          <Input
            id={`serial-${line.key}`}
            value={line.serialNumber}
            onChange={(event) => onChange({ serialNumber: event.target.value })}
            placeholder="Opcional"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`cost-${line.key}`} required>
            Costo de compra
          </Label>
          <Input
            id={`cost-${line.key}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={line.unitCost}
            onChange={(event) => onChange({ unitCost: event.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`price-${line.key}`} required>
            Precio de venta
          </Label>
          <Input
            id={`price-${line.key}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={line.salePrice}
            onChange={(event) => onChange({ salePrice: event.target.value })}
          />
        </div>
      </div>
    </LineWrapper>
  );
}

function AccessoryLineFields({
  line,
  index,
  accessories,
  onChange,
  onRemove,
}: {
  line: AccessoryLine;
  index: number;
  accessories: AccessoryOption[];
  onChange: (patch: Partial<AccessoryLine>) => void;
  onRemove: () => void;
}) {
  const selected = accessories.find((accessory) => accessory.id === line.accessoryId);

  return (
    <LineWrapper title="Accesorio" index={index} onRemove={onRemove}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 lg:col-span-1">
          <Label htmlFor={`accessory-${line.key}`} required>
            Accesorio
          </Label>
          <Select
            id={`accessory-${line.key}`}
            value={line.accessoryId}
            onChange={(event) => onChange({ accessoryId: event.target.value })}
          >
            <option value="">Seleccioná…</option>
            {accessories.map((accessory) => (
              <option key={accessory.id} value={accessory.id}>
                {accessory.name}
              </option>
            ))}
          </Select>
          {selected ? (
            <p className="text-[12px] text-fg-tertiary">
              {ACCESSORY_CATEGORY_LABELS[selected.category]} · stock actual{" "}
              {selected.stockQuantity}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`quantity-${line.key}`} required>
            Cantidad
          </Label>
          <Input
            id={`quantity-${line.key}`}
            type="number"
            inputMode="numeric"
            min={1}
            value={line.quantity}
            onChange={(event) => onChange({ quantity: event.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`acost-${line.key}`} required>
            Costo unitario
          </Label>
          <Input
            id={`acost-${line.key}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={line.unitCost}
            onChange={(event) => onChange({ unitCost: event.target.value })}
          />
          {selected && line.unitCost ? (
            <p className="text-[12px] text-fg-tertiary">
              Se vende a {formatCurrency(selected.salePrice)}
            </p>
          ) : null}
        </div>
      </div>
    </LineWrapper>
  );
}
