import { describe, expect, it } from "vitest";
import { createDeviceSchema } from "@/lib/validations/device";
import { DEVICE_CONDITION_LABELS, isNewCondition } from "@/lib/constants";

const base = {
  modelId: "modelo-1",
  color: "Negro",
  storageGb: 128,
  imei: "350001000000018",
  salePrice: 700_000,
  entryDate: new Date("2026-01-15"),
  requiresImei: true,
};

describe("Estado del equipo", () => {
  it("distingue entre nuevo sellado, nuevo sin sellar y usado", () => {
    expect(DEVICE_CONDITION_LABELS.NUEVO_SELLADO).toBe("Nuevo sellado");
    expect(DEVICE_CONDITION_LABELS.NUEVO_SIN_SELLAR).toBe("Nuevo sin sellar");
    expect(DEVICE_CONDITION_LABELS.USADO).toBe("Usado");
  });

  it("considera nuevos a los dos estados sin uso previo", () => {
    expect(isNewCondition("NUEVO_SELLADO")).toBe(true);
    expect(isNewCondition("NUEVO_SIN_SELLAR")).toBe(true);
    expect(isNewCondition("USADO")).toBe(false);
  });

  it("no exige batería a un equipo nuevo sin sellar", () => {
    const result = createDeviceSchema.safeParse({ ...base, condition: "NUEVO_SIN_SELLAR" });
    expect(result.success).toBe(true);
  });

  it("sigue exigiendo batería a un equipo usado", () => {
    const result = createDeviceSchema.safeParse({ ...base, condition: "USADO" });
    expect(result.success).toBe(false);
  });
});
