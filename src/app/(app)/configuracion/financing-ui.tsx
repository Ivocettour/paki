"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { FinancingType } from "@prisma/client";
import {
  createFinancingPlanAction,
  deleteFinancingPlanAction,
  updateFinancingPlanAction,
} from "@/lib/actions/financing";
import type { FinancingPlanItem } from "@/lib/services/financing";
import { FINANCED_TYPES } from "@/lib/validations/financing";
import { quoteFinancing, MAX_SURCHARGE_PERCENT } from "@/lib/domain/financing";
import { FINANCING_TYPE_HINTS, FINANCING_TYPE_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { formatCurrency } from "@/lib/utils";

/// Importe de referencia para mostrar qué significa cada porcentaje.
const EXAMPLE_PRICE = 100_000;

type FinancedType = (typeof FINANCED_TYPES)[number];

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}%`;
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

function PlanDialog({
  open,
  onClose,
  plan,
  defaultType,
}: {
  open: boolean;
  onClose: () => void;
  plan?: FinancingPlanItem;
  defaultType: FinancedType;
}) {
  const router = useRouter();
  const isEdit = Boolean(plan);

  const [type, setType] = useState<FinancedType>(
    (plan?.type as FinancedType | undefined) ?? defaultType,
  );
  const [installments, setInstallments] = useState(String(plan?.installments ?? 3));
  const [percent, setPercent] = useState(String(plan?.surchargePercent ?? 0));
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const count = Number(installments);
  const percentValue = Number(percent);
  const validPreview = count >= 1 && percentValue >= 0 && percent !== "";
  const preview = validPreview ? quoteFinancing(EXAMPLE_PRICE, percentValue, count) : null;

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    const payload = {
      type,
      installments: count,
      surchargePercent: percentValue,
      isActive,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateFinancingPlanAction(plan!.id, payload)
        : await createFinancingPlanAction(payload);

      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      toast.success(isEdit ? "Plan actualizado" : "Plan creado");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Editar plan de financiación" : "Nuevo plan de financiación"}
      description="El recargo es una sugerencia: al registrar cada venta se puede cambiar a mano."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button loading={isPending} disabled={!validPreview} onClick={handleSubmit}>
            {isEdit ? "Guardar" : "Crear plan"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorBanner message={error} />

        <Field label="Tipo" htmlFor="planType" required error={fieldErrors.type?.[0]}>
          <Select
            id="planType"
            value={type}
            onChange={(event) => setType(event.target.value as FinancedType)}
          >
            {FINANCED_TYPES.map((value) => (
              <option key={value} value={value}>
                {FINANCING_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Cantidad de cuotas"
            htmlFor="planInstallments"
            required
            error={fieldErrors.installments?.[0]}
          >
            <Input
              id="planInstallments"
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={installments}
              onChange={(event) => setInstallments(event.target.value)}
            />
          </Field>

          <Field
            label="Recargo (%)"
            htmlFor="planPercent"
            required
            error={fieldErrors.surchargePercent?.[0]}
            hint="0 = sin interés."
          >
            <Input
              id="planPercent"
              type="number"
              inputMode="decimal"
              min={0}
              max={MAX_SURCHARGE_PERCENT}
              step="0.01"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
            />
          </Field>
        </div>

        {preview ? (
          <p className="rounded-[12px] bg-surface-subtle px-3.5 py-3 text-[13px] text-fg-secondary">
            Ejemplo: un equipo de{" "}
            <span className="tabular font-medium text-fg">{formatCurrency(EXAMPLE_PRICE)}</span>{" "}
            queda en{" "}
            <span className="tabular font-medium text-fg">{formatCurrency(preview.total)}</span>,
            o {preview.installmentCount}{" "}
            {preview.installmentCount === 1 ? "cuota" : "cuotas"} de{" "}
            <span className="tabular font-medium text-fg">
              {formatCurrency(preview.installmentAmount)}
            </span>
            .
          </p>
        ) : null}

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-line accent-[var(--accent)]"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          <span className="text-[13px] text-fg-secondary">
            Plan activo.{" "}
            <span className="text-fg-tertiary">
              Los planes activos se sugieren al vender y se muestran en la tienda.
            </span>
          </span>
        </label>
      </div>
    </Dialog>
  );
}

function PlanRow({ plan, canManage }: { plan: FinancingPlanItem; canManage: boolean }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = quoteFinancing(EXAMPLE_PRICE, plan.surchargePercent, plan.installments);

  function handleDelete() {
    setError(null);

    startTransition(async () => {
      const result = await deleteFinancingPlanAction(plan.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Plan eliminado");
      setDeleteOpen(false);
      router.refresh();
    });
  }

  return (
    <li className="flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-fg">
          {plan.installments} {plan.installments === 1 ? "cuota" : "cuotas"}
        </p>
        <p className="tabular text-[12px] text-fg-tertiary">
          {formatCurrency(EXAMPLE_PRICE)} → {formatCurrency(preview.total)} ·{" "}
          {formatCurrency(preview.installmentAmount)} por cuota
        </p>
      </div>

      <span className="tabular w-24 text-right text-[14px] font-medium text-fg">
        {plan.surchargePercent === 0 ? "Sin interés" : `+${formatPercent(plan.surchargePercent)}`}
      </span>

      <Badge tone={plan.isActive ? "success" : "neutral"}>
        {plan.isActive ? "Activo" : "Inactivo"}
      </Badge>

      {canManage ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label={`Editar el plan de ${plan.installments} cuotas`}
            className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-subtle hover:text-fg"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            aria-label={`Eliminar el plan de ${plan.installments} cuotas`}
            className="grid size-8 place-items-center rounded-full text-fg-tertiary transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      {editOpen ? (
        <PlanDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          plan={plan}
          defaultType={plan.type as FinancedType}
        />
      ) : null}

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Eliminar plan"
        description="Las ventas ya registradas conservan el recargo que se les aplicó."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button variant="danger" loading={isPending} onClick={handleDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        <ErrorBanner message={error} />
      </Dialog>
    </li>
  );
}

/// Planes de financiación: recargo sugerido por cantidad de cuotas.
export function FinancingPlans({
  plans,
  canManage,
}: {
  plans: FinancingPlanItem[];
  canManage: boolean;
}) {
  const [newPlanType, setNewPlanType] = useState<FinancedType | null>(null);

  return (
    <Card className="mt-6 overflow-hidden">
      <CardHeader
        title="Financiación en cuotas"
        description="Recargo (interés) sugerido según la cantidad de cuotas. Al vender se puede ajustar a mano."
        action={
          canManage ? (
            <Button variant="secondary" size="sm" onClick={() => setNewPlanType(FinancingType.TARJETA)}>
              <Plus className="size-4" aria-hidden />
              Plan
            </Button>
          ) : null
        }
      />

      {plans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Todavía no hay planes de financiación"
          description="Sin planes, el recargo arranca en 0% y se escribe a mano en cada venta."
          action={
            canManage ? (
              <Button onClick={() => setNewPlanType(FinancingType.TARJETA)}>
                <Plus className="size-4" aria-hidden />
                Crear el primer plan
              </Button>
            ) : null
          }
        />
      ) : (
        FINANCED_TYPES.map((type) => {
          const group = plans.filter((plan) => plan.type === type);

          return (
            <section key={type} className="border-b border-line-subtle last:border-0">
              <div className="flex items-center justify-between gap-4 bg-surface-muted px-5 py-2.5">
                <div>
                  <h3 className="text-[13px] font-semibold text-fg">
                    {FINANCING_TYPE_LABELS[type]}
                  </h3>
                  <p className="text-[12px] text-fg-tertiary">{FINANCING_TYPE_HINTS[type]}</p>
                </div>
                {canManage ? (
                  <Button variant="ghost" size="sm" onClick={() => setNewPlanType(type)}>
                    <Plus className="size-4" aria-hidden />
                    Agregar
                  </Button>
                ) : null}
              </div>

              {group.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-fg-tertiary">
                  Sin planes para este tipo.
                </p>
              ) : (
                <ul className="divide-y divide-line-subtle">
                  {group.map((plan) => (
                    <PlanRow key={plan.id} plan={plan} canManage={canManage} />
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}

      {newPlanType ? (
        <PlanDialog
          open
          onClose={() => setNewPlanType(null)}
          defaultType={newPlanType}
        />
      ) : null}
    </Card>
  );
}
