import { describe, expect, it } from "vitest";
import { quoteFinancing, surchargeAmount } from "@/lib/domain/financing";
import { createSaleSchema } from "@/lib/validations/sale";
import { financingPlanSchema } from "@/lib/validations/financing";

describe("Recargo por financiación", () => {
  it("aplica el porcentaje sobre la base", () => {
    expect(surchargeAmount(100_000, 20)).toBe(20_000);
    expect(surchargeAmount(100_000, 0)).toBe(0);
  });

  it("redondea a centavos", () => {
    // 33,33 % de 100 = 33,33
    expect(surchargeAmount(100, 33.33)).toBe(33.33);
    expect(surchargeAmount(1_000, 12.345)).toBe(123.45);
  });

  it("ignora porcentajes o bases inválidos", () => {
    expect(surchargeAmount(-5, 10)).toBe(0);
    expect(surchargeAmount(100, -10)).toBe(0);
    expect(surchargeAmount(100, Number.NaN)).toBe(0);
  });

  it("arma el presupuesto con total y valor de cuota", () => {
    const quote = quoteFinancing(900_000, 20, 6);

    expect(quote.surcharge).toBe(180_000);
    expect(quote.total).toBe(1_080_000);
    expect(quote.installmentCount).toBe(6);
    expect(quote.installmentAmount).toBe(180_000);
  });

  it("sin recargo, el total no cambia", () => {
    const quote = quoteFinancing(300_000, 0, 3);
    expect(quote.total).toBe(300_000);
    expect(quote.installmentAmount).toBe(100_000);
  });
});

describe("Validación del recargo en la venta", () => {
  const base = {
    deviceIds: ["equipo-1"],
    accessoryItems: [],
    discount: 0,
    paymentMethod: "EFECTIVO",
    financingType: "TARJETA",
    installmentCount: 6,
  };

  it("acepta un recargo manual", () => {
    const result = createSaleSchema.safeParse({ ...base, surchargePercent: 18.5 });
    expect(result.success).toBe(true);
  });

  it("asume 0% cuando no se informa", () => {
    const result = createSaleSchema.safeParse(base);
    expect(result.success && result.data.surchargePercent).toBe(0);
  });

  it("rechaza un recargo negativo o desmedido", () => {
    expect(createSaleSchema.safeParse({ ...base, surchargePercent: -1 }).success).toBe(false);
    expect(createSaleSchema.safeParse({ ...base, surchargePercent: 301 }).success).toBe(false);
  });
});

describe("Plan de financiación", () => {
  it("acepta cuotas sin interés", () => {
    const result = financingPlanSchema.safeParse({
      type: "TARJETA",
      installments: 3,
      surchargePercent: 0,
    });
    expect(result.success).toBe(true);
  });

  it("no admite planes para el contado", () => {
    const result = financingPlanSchema.safeParse({
      type: "CONTADO",
      installments: 3,
      surchargePercent: 0,
    });
    expect(result.success).toBe(false);
  });

  it("redondea el porcentaje a dos decimales", () => {
    const result = financingPlanSchema.safeParse({
      type: "FINANCIACION_LOCAL",
      installments: 12,
      surchargePercent: 25.456,
    });
    expect(result.success && result.data.surchargePercent).toBe(25.46);
  });

  it("rechaza cantidades de cuotas fuera de rango", () => {
    for (const installments of [0, 61, 2.5]) {
      const result = financingPlanSchema.safeParse({
        type: "TARJETA",
        installments,
        surchargePercent: 10,
      });
      expect(result.success).toBe(false);
    }
  });
});
