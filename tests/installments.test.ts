import { describe, expect, it } from "vitest";
import { InstallmentStatus } from "@prisma/client";
import { buildInstallmentPlan, resolveDisplayStatus } from "@/lib/domain/installments";

describe("Plan de cuotas", () => {
  it("reparte el total en la cantidad de cuotas pedida", () => {
    const plan = buildInstallmentPlan(900_000, 6, new Date(2026, 2, 10));

    expect(plan).toHaveLength(6);
    expect(plan.every((item) => item.amount === 150_000)).toBe(true);
  });

  it("nunca pierde ni inventa un peso al redondear", () => {
    // 100.000 / 3 no da un monto exacto: el resto va a la primera cuota.
    const plan = buildInstallmentPlan(100_000, 3, new Date(2026, 2, 10));

    const total = plan.reduce((sum, item) => sum + item.amount, 0);
    expect(total).toBeCloseTo(100_000, 2);

    expect(plan[0].amount).toBeCloseTo(33_333.34, 2);
    expect(plan[1].amount).toBeCloseTo(33_333.33, 2);
    expect(plan[2].amount).toBeCloseTo(33_333.33, 2);
  });

  // Los vencimientos son días del calendario guardados como medianoche UTC,
  // por eso se leen con los getters UTC.
  it("vence una cuota por mes a partir de la fecha indicada", () => {
    const plan = buildInstallmentPlan(300_000, 3, new Date(2026, 0, 15, 12));

    expect(plan.map((item) => item.dueDate.getUTCMonth())).toEqual([0, 1, 2]);
    expect(plan.every((item) => item.dueDate.getUTCDate() === 15)).toBe(true);
    expect(plan.every((item) => item.dueDate.getUTCHours() === 0)).toBe(true);
  });

  it("no desborda de mes cuando el día de vencimiento no existe", () => {
    // El 31 de enero + 1 mes no es el 3 de marzo: se ancla al 28 de febrero.
    const plan = buildInstallmentPlan(300_000, 3, new Date(2026, 0, 31, 12));

    expect(plan[0].dueDate.getUTCDate()).toBe(31);
    expect(plan[1].dueDate.getUTCMonth()).toBe(1);
    expect(plan[1].dueDate.getUTCDate()).toBe(28);
    expect(plan[2].dueDate.getUTCMonth()).toBe(2);
    expect(plan[2].dueDate.getUTCDate()).toBe(31);
  });

  it("cruza el año correctamente", () => {
    const plan = buildInstallmentPlan(300_000, 3, new Date(2026, 10, 20, 12));

    expect(plan.map((item) => item.dueDate.getUTCMonth())).toEqual([10, 11, 0]);
    expect(plan[2].dueDate.getUTCFullYear()).toBe(2027);
  });

  it("rechaza una cantidad de cuotas inválida", () => {
    expect(() => buildInstallmentPlan(100_000, 0, new Date())).toThrow(
      /al menos 1/,
    );
  });
});

describe("Estado derivado de la cuota", () => {
  // Mediodía local, para que el día calendario del local sea el 15/06.
  const today = new Date(2026, 5, 15, 12);
  /// Vencimiento canónico: medianoche UTC del día indicado.
  const vence = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day));

  it("marca como vencida una cuota pendiente con vencimiento pasado", () => {
    const result = resolveDisplayStatus(
      InstallmentStatus.PENDIENTE,
      vence(2026, 5, 1),
      today,
    );

    expect(result.displayStatus).toBe("VENCIDA");
    expect(result.daysOverdue).toBe(14);
  });

  it("no marca como vencida la cuota que vence hoy", () => {
    const result = resolveDisplayStatus(
      InstallmentStatus.PENDIENTE,
      vence(2026, 5, 15),
      today,
    );

    expect(result.displayStatus).toBe("PENDIENTE");
    expect(result.daysOverdue).toBe(0);
  });

  it("una cuota futura sigue pendiente", () => {
    const result = resolveDisplayStatus(
      InstallmentStatus.PENDIENTE,
      vence(2026, 6, 1),
      today,
    );

    expect(result.displayStatus).toBe("PENDIENTE");
  });

  it("una cuota pagada nunca figura como vencida, aunque su fecha ya pasó", () => {
    const result = resolveDisplayStatus(
      InstallmentStatus.PAGADA,
      vence(2026, 0, 1),
      today,
    );

    expect(result.displayStatus).toBe("PAGADA");
    expect(result.daysOverdue).toBe(0);
  });

  it("el vencimiento se evalúa en la zona del local, no en la del servidor", () => {
    // En producción el servidor corre en UTC. Una cuota que vence el 15 no debe
    // figurar vencida a las 00:30 UTC del 15, que en Argentina siguen siendo
    // las 21:30 del 14.
    const dueDate = new Date(Date.UTC(2026, 5, 15)); // vencimiento: 15/06
    const nowUtc = new Date(Date.UTC(2026, 5, 15, 0, 30)); // 14/06 21:30 en Argentina

    const result = resolveDisplayStatus(InstallmentStatus.PENDIENTE, dueDate, nowUtc);

    expect(result.displayStatus).toBe("PENDIENTE");
    expect(result.daysOverdue).toBe(0);
  });
});
