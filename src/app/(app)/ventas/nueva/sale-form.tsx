"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import {
  AccessoryCategory,
  FinancingType,
  PaymentMethod,
  type DeviceCondition,
} from "@prisma/client";
import {
  createSaleAction,
  searchCustomersAction,
  searchDevicesAction,
} from "@/lib/actions/sales";
import { searchAccessoriesAction } from "@/lib/actions/accessories";
import {
  ACCESSORY_CATEGORY_LABELS,
  FINANCING_TYPE_HINTS,
  FINANCING_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  formatStorage,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/field";
import { BatteryIndicator } from "@/components/ui/badge";
import { ConditionBadge } from "@/components/ui/status";
import { formatCurrency, toDateInputValue } from "@/lib/utils";
import { MAX_SURCHARGE_PERCENT, quoteFinancing } from "@/lib/domain/financing";
import type { FinancingPlanItem } from "@/lib/services/financing";
import { CustomerDialog } from "@/components/customer-dialog";

interface DeviceOption {
  id: string;
  imei: string | null;
  color: string;
  storageGb: number;
  condition: DeviceCondition;
  batteryPercent: number | null;
  salePrice: number;
  brandName: string;
  modelName: string;
}

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string;
  dni: string | null;
  phone: string | null;
}

interface AccessoryOption {
  id: string;
  name: string;
  brand: string | null;
  category: AccessoryCategory;
  salePrice: number;
  stockQuantity: number;
}

/// Accesorio agregado a la venta, con la cantidad elegida.
interface AccessoryLine extends AccessoryOption {
  quantity: number;
}

/// Un mes después de hoy: vencimiento habitual de la primera cuota.
function defaultFirstDueDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return toDateInputValue(date);
}

export function SaleForm({ financingPlans }: { financingPlans: FinancingPlanItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const [items, setItems] = useState<DeviceOption[]>([]);
  const [accessoryLines, setAccessoryLines] = useState<AccessoryLine[]>([]);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);

  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.EFECTIVO);
  const [financingType, setFinancingType] = useState<FinancingType>(FinancingType.CONTADO);
  const [installmentCount, setInstallmentCount] = useState("3");
  // Recargo (interés) por financiación. Arranca con el del plan, pero es manual.
  const [surchargePercent, setSurchargePercent] = useState("0");
  const [firstDueDate, setFirstDueDate] = useState(defaultFirstDueDate);
  const [notes, setNotes] = useState("");

  const subtotal =
    items.reduce((sum, item) => sum + item.salePrice, 0) +
    accessoryLines.reduce((sum, line) => sum + line.salePrice * line.quantity, 0);
  const productCount = items.length + accessoryLines.length;
  const discountValue = Number(discount) || 0;
  const discountTooBig = discountValue > subtotal;
  const base = Math.max(0, subtotal - discountValue);

  const generatesInstallments = financingType === FinancingType.FINANCIACION_LOCAL;
  const hasInstallments = financingType !== FinancingType.CONTADO;

  const surchargeValue = hasInstallments ? Number(surchargePercent) || 0 : 0;
  const surchargeInvalid = surchargeValue < 0 || surchargeValue > MAX_SURCHARGE_PERCENT;
  // Mismo cálculo que hace el servidor: lo que se ve es lo que se guarda.
  const quote = quoteFinancing(
    base,
    surchargeInvalid ? 0 : surchargeValue,
    Number(installmentCount) || 1,
  );
  const total = quote.total;
  const installmentAmount = quote.installmentAmount;

  const plansForType = financingPlans.filter((plan) => plan.type === financingType);

  /// Al elegir otra cantidad de cuotas se sugiere el recargo de su plan.
  /// Si no hay plan para esa cantidad, el valor actual no se toca.
  function changeInstallmentCount(value: string) {
    setInstallmentCount(value);
    const plan = financingPlans.find(
      (candidate) => candidate.type === financingType && candidate.installments === Number(value),
    );
    if (plan) setSurchargePercent(String(plan.surchargePercent));
  }

  function changeFinancingType(type: FinancingType) {
    setFinancingType(type);
    if (type === FinancingType.CONTADO) return;

    const plan = financingPlans.find(
      (candidate) => candidate.type === type && candidate.installments === Number(installmentCount),
    );
    setSurchargePercent(String(plan?.surchargePercent ?? 0));
  }

  function addDevice(device: DeviceOption) {
    setItems((current) =>
      current.some((item) => item.id === device.id) ? current : [...current, device],
    );
  }

  function removeDevice(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  /// Al repetir un accesorio se suma una unidad, sin exceder el stock.
  function addAccessory(accessory: AccessoryOption) {
    setAccessoryLines((current) => {
      const existing = current.find((line) => line.id === accessory.id);
      if (!existing) return [...current, { ...accessory, quantity: 1 }];

      return current.map((line) =>
        line.id === accessory.id
          ? { ...line, quantity: Math.min(line.quantity + 1, line.stockQuantity) }
          : line,
      );
    });
  }

  function setAccessoryQuantity(id: string, quantity: number) {
    setAccessoryLines((current) =>
      current.map((line) =>
        line.id === id
          ? { ...line, quantity: Math.max(1, Math.min(quantity, line.stockQuantity)) }
          : line,
      ),
    );
  }

  function removeAccessory(id: string) {
    setAccessoryLines((current) => current.filter((line) => line.id !== id));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const result = await createSaleAction({
        deviceIds: items.map((item) => item.id),
        accessoryItems: accessoryLines.map((line) => ({
          accessoryId: line.id,
          quantity: line.quantity,
        })),
        customerId: customer?.id,
        discount: discountValue,
        paymentMethod,
        financingType,
        installmentCount: hasInstallments ? Number(installmentCount) : null,
        surchargePercent: surchargeValue,
        firstDueDate: generatesInstallments ? new Date(firstDueDate) : null,
        notes,
      });

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      toast.success(`Venta ${result.data.saleNumber} registrada`, {
        description: `${productCount} ${
          productCount === 1 ? "producto vendido" : "productos vendidos"
        }. El stock se actualizó.`,
      });

      router.push(`/ventas/${result.data.id}`);
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
        <CardHeader
          title="Equipos"
          description="Buscá por IMEI, marca o modelo. Solo aparecen equipos disponibles."
        />
        <CardBody className="space-y-4">
          <DeviceSearch onSelect={addDevice} selectedIds={items.map((item) => item.id)} />

          {items.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-line px-4 py-8 text-center text-[13px] text-fg-tertiary">
              Todavía no agregaste equipos a la venta.
            </p>
          ) : (
            <ul className="divide-y divide-line-subtle rounded-[12px] border border-line-subtle">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-fg">
                      {item.brandName} {item.modelName}
                    </p>
                    <p className="text-[12px] text-fg-tertiary">
                      {item.color} · {formatStorage(item.storageGb)}
                      {item.imei ? ` · IMEI ${item.imei}` : ""}
                    </p>
                  </div>
                  <ConditionBadge condition={item.condition} />
                  <BatteryIndicator percent={item.batteryPercent} />
                  <span className="tabular w-32 text-right text-[14px] font-medium">
                    {formatCurrency(item.salePrice)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDevice(item.id)}
                    aria-label={`Quitar ${item.brandName} ${item.modelName}`}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-fg-tertiary hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Accesorios"
          description="Se venden por cantidad. Solo aparecen los que tienen stock."
        />
        <CardBody className="space-y-4">
          <AccessorySearch onSelect={addAccessory} />

          {accessoryLines.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-tertiary">
              Sin accesorios en esta venta.
            </p>
          ) : (
            <ul className="divide-y divide-line-subtle rounded-[12px] border border-line-subtle">
              {accessoryLines.map((line) => (
                <li key={line.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-fg">{line.name}</p>
                    <p className="text-[12px] text-fg-tertiary">
                      {ACCESSORY_CATEGORY_LABELS[line.category]}
                      {line.brand ? ` · ${line.brand}` : ""} · stock {line.stockQuantity}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label={`Quitar una unidad de ${line.name}`}
                      disabled={line.quantity <= 1}
                      onClick={() => setAccessoryQuantity(line.id, line.quantity - 1)}
                    >
                      <Minus className="size-3.5" aria-hidden />
                    </Button>
                    <span className="tabular w-8 text-center text-[14px] font-medium">
                      {line.quantity}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label={`Agregar una unidad de ${line.name}`}
                      disabled={line.quantity >= line.stockQuantity}
                      onClick={() => setAccessoryQuantity(line.id, line.quantity + 1)}
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </Button>
                  </div>

                  <span className="tabular w-28 text-right text-[14px] font-medium">
                    {formatCurrency(line.salePrice * line.quantity)}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeAccessory(line.id)}
                    aria-label={`Quitar ${line.name}`}
                    className="grid size-8 shrink-0 place-items-center rounded-full text-fg-tertiary hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Cliente"
          description="Opcional. Si no cargás cliente, la venta queda como consumidor final."
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCustomerDialogOpen(true)}
            >
              <UserPlus className="size-4" aria-hidden />
              Nuevo cliente
            </Button>
          }
        />
        <CardBody>
          {customer ? (
            <div className="flex items-center justify-between gap-4 rounded-[12px] border border-line-subtle px-4 py-3">
              <div>
                <p className="text-[14px] font-medium text-fg">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="text-[12px] text-fg-tertiary">
                  {[customer.dni && `DNI ${customer.dni}`, customer.phone]
                    .filter(Boolean)
                    .join(" · ") || "Sin datos de contacto"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomer(null)}
                aria-label="Quitar cliente"
                className="grid size-8 place-items-center rounded-full text-fg-tertiary hover:bg-surface-subtle hover:text-fg"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <CustomerSearch onSelect={setCustomer} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Pago y financiación" />
        <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Método de pago" htmlFor="paymentMethod" required>
            <Select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
            >
              {Object.values(PaymentMethod).map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Financiación"
            htmlFor="financingType"
            required
            hint={FINANCING_TYPE_HINTS[financingType]}
          >
            <Select
              id="financingType"
              value={financingType}
              onChange={(event) => changeFinancingType(event.target.value as FinancingType)}
            >
              {Object.values(FinancingType).map((type) => (
                <option key={type} value={type}>
                  {FINANCING_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>

          {hasInstallments ? (
            <Field label="Cantidad de cuotas" htmlFor="installmentCount" required>
              <Input
                id="installmentCount"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                value={installmentCount}
                onChange={(event) => changeInstallmentCount(event.target.value)}
              />
            </Field>
          ) : null}

          {hasInstallments ? (
            <Field
              label="Recargo / interés (%)"
              htmlFor="surchargePercent"
              error={
                surchargeInvalid
                  ? `Ingresá un porcentaje entre 0 y ${MAX_SURCHARGE_PERCENT}.`
                  : undefined
              }
              hint={
                plansForType.length > 0
                  ? "Se completa según el plan, pero podés escribir el que quieras."
                  : "0 = sin interés. Se aplica sobre el total menos el descuento."
              }
            >
              <Input
                id="surchargePercent"
                type="number"
                inputMode="decimal"
                min={0}
                max={MAX_SURCHARGE_PERCENT}
                step="0.01"
                value={surchargePercent}
                onChange={(event) => setSurchargePercent(event.target.value)}
                aria-invalid={surchargeInvalid}
              />
            </Field>
          ) : null}

          {hasInstallments && plansForType.length > 0 ? (
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-[13px] font-medium text-fg-secondary">
                Planes disponibles
              </p>
              <div className="flex flex-wrap gap-2">
                {plansForType.map((plan) => {
                  const selected =
                    Number(installmentCount) === plan.installments &&
                    Number(surchargePercent) === plan.surchargePercent;

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setInstallmentCount(String(plan.installments));
                        setSurchargePercent(String(plan.surchargePercent));
                      }}
                      className={
                        "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors " +
                        (selected
                          ? "border-accent bg-accent-soft font-medium text-accent"
                          : "border-line text-fg-secondary hover:bg-surface-subtle")
                      }
                    >
                      {plan.installments} {plan.installments === 1 ? "cuota" : "cuotas"} ·{" "}
                      {plan.surchargePercent === 0 ? "sin interés" : `+${plan.surchargePercent}%`}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {generatesInstallments ? (
            <Field
              label="Vencimiento de la primera cuota"
              htmlFor="firstDueDate"
              required
              hint="Las siguientes vencen el mismo día de cada mes."
            >
              <Input
                id="firstDueDate"
                type="date"
                value={firstDueDate}
                onChange={(event) => setFirstDueDate(event.target.value)}
              />
            </Field>
          ) : null}

          <Field
            label="Descuento"
            htmlFor="discount"
            error={discountTooBig ? "El descuento no puede superar el subtotal." : undefined}
          >
            <Input
              id="discount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              aria-invalid={discountTooBig}
            />
          </Field>

          <Field label="Observaciones" htmlFor="notes" className="sm:col-span-2">
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opcional"
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2.5">
          <div className="flex justify-between text-[14px] text-fg-secondary">
            <span>
              Subtotal ({productCount} {productCount === 1 ? "producto" : "productos"})
            </span>
            <span className="tabular">{formatCurrency(subtotal)}</span>
          </div>

          {discountValue > 0 ? (
            <div className="flex justify-between text-[14px] text-fg-secondary">
              <span>Descuento</span>
              <span className="tabular">−{formatCurrency(discountValue)}</span>
            </div>
          ) : null}

          {quote.surcharge > 0 ? (
            <div className="flex justify-between text-[14px] text-fg-secondary">
              <span>Recargo por financiación ({surchargeValue}%)</span>
              <span className="tabular">+{formatCurrency(quote.surcharge)}</span>
            </div>
          ) : null}

          <div className="flex items-baseline justify-between border-t border-line-subtle pt-3">
            <span className="text-[15px] font-medium text-fg">Total</span>
            <span className="tabular text-[26px] font-semibold tracking-[-0.03em] text-fg">
              {formatCurrency(total)}
            </span>
          </div>

          {hasInstallments && Number(installmentCount) > 0 ? (
            <p className="text-right text-[13px] text-fg-secondary">
              {installmentCount} cuotas de{" "}
              <span className="tabular font-medium text-fg">
                {formatCurrency(installmentAmount)}
              </span>
              {generatesInstallments ? (
                <span className="block text-[12px] text-fg-tertiary">
                  El cliente queda debiendo al local.
                </span>
              ) : (
                <span className="block text-[12px] text-fg-tertiary">
                  El banco liquida el total. No genera deuda con el local.
                </span>
              )}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2.5 pb-2">
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          disabled={productCount === 0 || discountTooBig || surchargeInvalid}
        >
          Registrar venta
        </Button>
      </div>

      <CustomerDialog
        open={customerDialogOpen}
        onClose={() => setCustomerDialogOpen(false)}
        onCreated={(created) => {
          setCustomer(created);
          setCustomerDialogOpen(false);
        }}
      />
    </form>
  );
}

/// Buscador con debounce que consulta equipos disponibles en el servidor.
function DeviceSearch({
  onSelect,
  selectedIds,
}: {
  onSelect: (device: DeviceOption) => void;
  selectedIds: string[];
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<DeviceOption[]>([]);
  const [loading, setLoading] = useState(false);

  const isSearchable = term.trim().length >= 2;

  // Todo el estado se actualiza dentro del callback con debounce: llamar a
  // setState en el cuerpo del efecto encadena renders innecesarios.
  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);

      const result = await searchDevicesAction(trimmed);
      if (cancelled) return;

      setResults(result.ok ? (result.data as DeviceOption[]) : []);
      setLoading(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  // Los resultados visibles se derivan del término actual, no de un estado
  // espejo que haya que limpiar.
  const available = isSearchable
    ? results.filter((device) => !selectedIds.includes(device.id))
    : [];

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary"
        aria-hidden
      />
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar equipo por IMEI, marca o modelo…"
        aria-label="Buscar equipo"
        className="pl-10 pr-10"
      />
      {loading ? (
        <Loader2
          className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-tertiary"
          aria-hidden
        />
      ) : null}

      {isSearchable && !loading ? (
        available.length === 0 ? (
          <p className="mt-2 text-[13px] text-fg-tertiary">
            No hay equipos disponibles que coincidan con la búsqueda.
          </p>
        ) : (
          <ul className="mt-2 max-h-72 overflow-y-auto rounded-[12px] border border-line-subtle">
            {available.map((device) => (
              <li key={device.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(device);
                    setTerm("");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-subtle"
                >
                  <Plus className="size-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-fg">
                      {device.brandName} {device.modelName}
                    </span>
                    <span className="block text-[12px] text-fg-tertiary">
                      {device.color} · {formatStorage(device.storageGb)}
                      {device.imei ? ` · ${device.imei}` : ""}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[14px] font-medium">
                    {formatCurrency(device.salePrice)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

/// Buscador de accesorios con stock disponible.
function AccessorySearch({ onSelect }: { onSelect: (accessory: AccessoryOption) => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<AccessoryOption[]>([]);
  const [loading, setLoading] = useState(false);

  const isSearchable = term.trim().length >= 2;

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);

      const result = await searchAccessoriesAction(trimmed);
      if (cancelled) return;

      setResults(result.ok ? (result.data as AccessoryOption[]) : []);
      setLoading(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const visible = isSearchable ? results : [];

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary"
        aria-hidden
      />
      <Input
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar accesorio por nombre, marca o código…"
        aria-label="Buscar accesorio"
        className="pl-10 pr-10"
      />
      {loading ? (
        <Loader2
          className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-tertiary"
          aria-hidden
        />
      ) : null}

      {isSearchable && !loading ? (
        visible.length === 0 ? (
          <p className="mt-2 text-[13px] text-fg-tertiary">
            No hay accesorios con stock que coincidan con la búsqueda.
          </p>
        ) : (
          <ul className="mt-2 max-h-64 overflow-y-auto rounded-[12px] border border-line-subtle">
            {visible.map((accessory) => (
              <li key={accessory.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(accessory);
                    setTerm("");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-subtle"
                >
                  <Plus className="size-4 shrink-0 text-accent" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] text-fg">{accessory.name}</span>
                    <span className="block text-[12px] text-fg-tertiary">
                      {ACCESSORY_CATEGORY_LABELS[accessory.category]}
                      {accessory.brand ? ` · ${accessory.brand}` : ""} · stock{" "}
                      {accessory.stockQuantity}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-[14px] font-medium">
                    {formatCurrency(accessory.salePrice)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function CustomerSearch({ onSelect }: { onSelect: (customer: CustomerOption) => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);

  const isSearchable = term.trim().length >= 2;

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);

      const result = await searchCustomersAction(trimmed);
      if (cancelled) return;

      setResults(result.ok ? (result.data as CustomerOption[]) : []);
      setLoading(false);
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const visible = isSearchable ? results : [];

  return (
    <div className="relative">
      <Label htmlFor="customerSearch" className="mb-1.5">
        Buscar cliente
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary"
          aria-hidden
        />
        <Input
          id="customerSearch"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Nombre, apellido o DNI…"
          className="pl-10"
        />
        {loading ? (
          <Loader2
            className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-fg-tertiary"
            aria-hidden
          />
        ) : null}
      </div>

      {!loading && visible.length > 0 ? (
        <ul className="mt-2 max-h-60 overflow-y-auto rounded-[12px] border border-line-subtle">
          {visible.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(option);
                  setTerm("");
                }}
                className="flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors hover:bg-surface-subtle"
              >
                <span className="text-[14px] text-fg">
                  {option.firstName} {option.lastName}
                </span>
                <span className="text-[12px] text-fg-tertiary">
                  {[option.dni && `DNI ${option.dni}`, option.phone]
                    .filter(Boolean)
                    .join(" · ") || "Sin datos de contacto"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
