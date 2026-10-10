import { FinancingType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { toNumber } from "@/lib/serialize";
import { FINANCING_TYPE_LABELS } from "@/lib/constants";
import { recordAudit } from "./audit";
import type { FinancingPlanInput } from "@/lib/validations/financing";

export interface FinancingPlanItem {
  id: string;
  type: FinancingType;
  installments: number;
  surchargePercent: number;
  isActive: boolean;
}

const PLAN_SELECT = {
  id: true,
  type: true,
  installments: true,
  surchargePercent: true,
  isActive: true,
} satisfies Prisma.FinancingPlanSelect;

function toItem(row: {
  id: string;
  type: FinancingType;
  installments: number;
  surchargePercent: Prisma.Decimal;
  isActive: boolean;
}): FinancingPlanItem {
  return { ...row, surchargePercent: toNumber(row.surchargePercent) };
}

function planLabel(type: FinancingType, installments: number): string {
  return `${FINANCING_TYPE_LABELS[type]} · ${installments} ${
    installments === 1 ? "cuota" : "cuotas"
  }`;
}

/// Todos los planes, para la pantalla de configuración.
export async function listFinancingPlans(): Promise<FinancingPlanItem[]> {
  await requirePermission("configuracion.ver");

  const rows = await prisma.financingPlan.findMany({
    orderBy: [{ type: "asc" }, { installments: "asc" }],
    select: PLAN_SELECT,
  });
  return rows.map(toItem);
}

/// Planes activos que se sugieren al registrar una venta.
export async function listActiveFinancingPlans(): Promise<FinancingPlanItem[]> {
  await requirePermission("ventas.registrar");

  const rows = await prisma.financingPlan.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { installments: "asc" }],
    select: PLAN_SELECT,
  });
  return rows.map(toItem);
}

function translateUniqueError(error: unknown, input: FinancingPlanInput): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw errors.conflicto(
      `Ya existe un plan de ${input.installments} ${
        input.installments === 1 ? "cuota" : "cuotas"
      } para ${FINANCING_TYPE_LABELS[input.type]}. Editalo en lugar de crear otro.`,
    );
  }
  throw error;
}

export async function createFinancingPlan(input: FinancingPlanInput): Promise<{ id: string }> {
  const user = await requirePermission("catalogo.gestionar");

  try {
    return await prisma.$transaction(async (tx) => {
      const plan = await tx.financingPlan.create({
        data: {
          type: input.type,
          installments: input.installments,
          surchargePercent: input.surchargePercent,
          isActive: input.isActive,
        },
        select: { id: true },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "MODIFICAR_CONFIGURACION",
        entity: "FinancingPlan",
        entityId: plan.id,
        changes: {
          plan: { anterior: null, nuevo: planLabel(input.type, input.installments) },
          recargoPorcentaje: { anterior: null, nuevo: input.surchargePercent },
        },
      });

      return plan;
    });
  } catch (error) {
    translateUniqueError(error, input);
  }
}

export async function updateFinancingPlan(
  id: string,
  input: FinancingPlanInput,
): Promise<void> {
  const user = await requirePermission("catalogo.gestionar");

  const current = await prisma.financingPlan.findUnique({
    where: { id },
    select: PLAN_SELECT,
  });
  if (!current) throw errors.noEncontrado("el plan de financiación");

  const before = toItem(current);
  const changes: Record<string, { anterior: unknown; nuevo: unknown }> = {};

  if (before.type !== input.type || before.installments !== input.installments) {
    changes.plan = {
      anterior: planLabel(before.type, before.installments),
      nuevo: planLabel(input.type, input.installments),
    };
  }
  if (before.surchargePercent !== input.surchargePercent) {
    changes.recargoPorcentaje = {
      anterior: before.surchargePercent,
      nuevo: input.surchargePercent,
    };
  }
  if (before.isActive !== input.isActive) {
    changes.activo = { anterior: before.isActive, nuevo: input.isActive };
  }

  if (Object.keys(changes).length === 0) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.financingPlan.update({
        where: { id },
        data: {
          type: input.type,
          installments: input.installments,
          surchargePercent: input.surchargePercent,
          isActive: input.isActive,
        },
      });

      await recordAudit(tx, {
        userId: user.id,
        action: "MODIFICAR_CONFIGURACION",
        entity: "FinancingPlan",
        entityId: id,
        changes,
      });
    });
  } catch (error) {
    translateUniqueError(error, input);
  }
}

/// Las ventas guardan el porcentaje que aplicaron, así que borrar un plan no
/// altera ninguna venta ni cuota ya registrada.
export async function deleteFinancingPlan(id: string): Promise<void> {
  const user = await requirePermission("catalogo.gestionar");

  const plan = await prisma.financingPlan.findUnique({
    where: { id },
    select: PLAN_SELECT,
  });
  if (!plan) throw errors.noEncontrado("el plan de financiación");

  await prisma.$transaction(async (tx) => {
    await tx.financingPlan.delete({ where: { id } });

    await recordAudit(tx, {
      userId: user.id,
      action: "MODIFICAR_CONFIGURACION",
      entity: "FinancingPlan",
      entityId: id,
      changes: { plan: { anterior: planLabel(plan.type, plan.installments), nuevo: null } },
    });
  });
}
