import type { DeviceCondition, InventoryStatus } from "@prisma/client";
import { Badge } from "./badge";
import { DEVICE_CONDITION_LABELS, INVENTORY_STATUS_LABELS } from "@/lib/constants";

const INVENTORY_TONES = {
  DISPONIBLE: "success",
  VENDIDO: "neutral",
  RESERVADO: "warning",
  INACTIVO: "danger",
} as const;

export function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  return <Badge tone={INVENTORY_TONES[status]}>{INVENTORY_STATUS_LABELS[status]}</Badge>;
}

const CONDITION_TONES = {
  NUEVO_SELLADO: "accent",
  NUEVO_SIN_SELLAR: "success",
  USADO: "neutral",
} as const;

export function ConditionBadge({ condition }: { condition: DeviceCondition }) {
  return (
    <Badge tone={CONDITION_TONES[condition]}>
      {DEVICE_CONDITION_LABELS[condition]}
    </Badge>
  );
}
