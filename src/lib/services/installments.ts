import { FinancingType, InstallmentStatus, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { toNumber, toNullableNumber } from "@/lib/serialize";
import { recordAudit } from "./audit";
import { resolveDisplayStatus, startOfBusinessToday } from "@/lib/domain/installments";
import type { InstallmentDisplayStatus } from "@/lib/constants";
import type { RegisterPaymentInput } from "@/lib/validations/installment";

export interface InstallmentRow {
  id: string;
  number: number;
  totalInstallments: number;
  dueDate: Date;
  amount: number;
  status: InstallmentStatus;
  displayStatus: InstallmentDisplayStatus;
  daysOverdue: number;
  paidAt: Date | null;
  paidAmount: number | null;
  saleId: string;
  saleNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  sellerName: string;
}

export interface InstallmentsSummary {
  overdueCount: number;
  overdueAmount: number;
  dueSoonCount: number;
  dueSoonAmount: number;
  pendingCount: number;
  pendingAmount: number;
}

const SALE_IS_ACTIVE = {
  status: SaleStatus.COMPLETADA,
  financingType: FinancingType.FINANCIACION_LOCAL,
} as const;

export type InstallmentFilter = "vencidas" | "proximas" | "pendientes" | "pagadas" | "todas";

/**
 * Recordatorio de cuotas a cobrar.
 *
 * Solo alcanza a ventas con financiación propia del local: las cuotas de
 * tarjeta las liquida el banco y no son deuda del cliente.
 * Las ventas anuladas quedan fuera.
 */
export async function getInstallments(filter: InstallmentFilter = "vencidas") {
  await requirePermission("cuotas.ver");

  const today = startOfBusinessToday();
  const inSevenDays = new Date(today.getTime() + 7 * 86_400_000);

  const statusFilter =
    filter === "pagadas"
      ? { status: InstallmentStatus.PAGADA }
      : filter === "vencidas"
        ? { status: InstallmentStatus.PENDIENTE, dueDate: { lt: today } }
        : filter === "proximas"
          ? {
              status: InstallmentStatus.PENDIENTE,
              dueDate: { gte: today, lte: inSevenDays },
            }
          : filter === "pendientes"
            ? { status: InstallmentStatus.PENDIENTE }
            : {};

  const rows = await prisma.installment.findMany({
    where: { sale: SALE_IS_ACTIVE, ...statusFilter },
    orderBy: [{ dueDate: "asc" }, { number: "asc" }],
    take: 200,
    select: {
      id: true,
      number: true,
      dueDate: true,
      amount: true,
      status: true,
      paidAt: true,
      paidAmount: true,
      sale: {
        select: {
          id: true,
          saleNumber: true,
          installmentCount: true,
          seller: { select: { firstName: true, lastName: true } },
          customer: { select: { firstName: true, lastName: true, phone: true } },
        },
      },
    },
  });

  return rows.map<InstallmentRow>((row) => {
    const { displayStatus, daysOverdue } = resolveDisplayStatus(row.status, row.dueDate);

    return {
      id: row.id,
      number: row.number,
      totalInstallments: row.sale.installmentCount ?? 0,
      dueDate: row.dueDate,
      amount: toNumber(row.amount),
      status: row.status,
      displayStatus,
      daysOverdue,
      paidAt: row.paidAt,
      paidAmount: toNullableNumber(row.paidAmount),
      saleId: row.sale.id,
      saleNumber: row.sale.saleNumber,
      customerName: row.sale.customer
        ? `${row.sale.customer.firstName} ${row.sale.customer.lastName}`
        : null,
      customerPhone: row.sale.customer?.phone ?? null,
      sellerName: `${row.sale.seller.firstName} ${row.sale.seller.lastName}`,
    };
  });
}

/// Totales para el recordatorio del dashboard y las pestañas del listado.
export async function getInstallmentsSummary(): Promise<InstallmentsSummary> {
  await requirePermission("cuotas.ver");

  const today = startOfBusinessToday();
  const inSevenDays = new Date(today.getTime() + 7 * 86_400_000);

  const base = { sale: SALE_IS_ACTIVE, status: InstallmentStatus.PENDIENTE };

  const [overdue, dueSoon, pending] = await Promise.all([
    prisma.installment.aggregate({
      where: { ...base, dueDate: { lt: today } },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.installment.aggregate({
      where: { ...base, dueDate: { gte: today, lte: inSevenDays } },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.installment.aggregate({
      where: base,
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  return {
    overdueCount: overdue._count,
    overdueAmount: toNumber(overdue._sum.amount),
    dueSoonCount: dueSoon._count,
    dueSoonAmount: toNumber(dueSoon._sum.amount),
    pendingCount: pending._count,
    pendingAmount: toNumber(pending._sum.amount),
  };
}

/// Registra el cobro de una cuota.
export async function registerInstallmentPayment(
  installmentId: string,
  input: RegisterPaymentInput,
): Promise<void> {
  const user = await requirePermission("cuotas.registrar_pago");

  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    select: {
      id: true,
      number: true,
      amount: true,
      status: true,
      sale: { select: { id: true, saleNumber: true, status: true } },
    },
  });

  if (!installment) throw errors.noEncontrado("la cuota");

  if (installment.status === InstallmentStatus.PAGADA) {
    throw errors.regla("Esta cuota ya figura como pagada.");
  }

  if (installment.status === InstallmentStatus.ANULADA) {
    throw errors.regla("Esta cuota está anulada y no puede cobrarse.");
  }

  if (installment.sale.status === SaleStatus.ANULADA) {
    throw errors.regla(
      `La venta ${installment.sale.saleNumber} está anulada: sus cuotas no se cobran.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.installment.update({
      where: { id: installmentId },
      data: {
        status: InstallmentStatus.PAGADA,
        paidAt: input.paidAt,
        paidAmount: input.paidAmount,
        paymentMethod: input.paymentMethod,
        notes: input.notes ?? null,
        registeredById: user.id,
      },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "REGISTRAR_PAGO_CUOTA",
      entity: "Installment",
      entityId: installmentId,
      changes: {
        estado: { anterior: InstallmentStatus.PENDIENTE, nuevo: InstallmentStatus.PAGADA },
        montoPactado: { anterior: null, nuevo: toNumber(installment.amount) },
        montoCobrado: { anterior: null, nuevo: input.paidAmount },
        venta: { anterior: null, nuevo: installment.sale.saleNumber },
      },
    });
  });
}

/// Revierte un cobro mal registrado. Reservado a administradores.
export async function cancelInstallmentPayment(
  installmentId: string,
  reason: string,
): Promise<void> {
  const user = await requirePermission("cuotas.anular_pago");

  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    select: { id: true, status: true, paidAmount: true },
  });

  if (!installment) throw errors.noEncontrado("la cuota");

  if (installment.status !== InstallmentStatus.PAGADA) {
    throw errors.regla("Solo se puede anular el cobro de una cuota pagada.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.installment.update({
      where: { id: installmentId },
      data: {
        status: InstallmentStatus.PENDIENTE,
        paidAt: null,
        paidAmount: null,
        paymentMethod: null,
        registeredById: null,
      },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "ANULAR_PAGO_CUOTA",
      entity: "Installment",
      entityId: installmentId,
      changes: {
        estado: { anterior: InstallmentStatus.PAGADA, nuevo: InstallmentStatus.PENDIENTE },
        montoRevertido: { anterior: toNullableNumber(installment.paidAmount), nuevo: null },
        motivo: { anterior: null, nuevo: reason },
      },
    });
  });
}

// El plan de cuotas y el estado derivado viven en `@/lib/domain/installments`:
// son reglas puras, sin base de datos ni sesión.
export { buildInstallmentPlan, resolveDisplayStatus } from "@/lib/domain/installments";
