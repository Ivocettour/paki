import { formatCurrency } from "@/lib/utils";

/**
 * Muestra los cambios registrados en una entrada de auditoría.
 *
 * Se usa tanto en la pantalla de Auditoría como en la ficha de cada equipo,
 * para que "quién cambió qué, de qué valor a cuál" se lea igual en los dos lados.
 */

export type AuditChanges = Record<string, { anterior: unknown; nuevo: unknown }>;

const FIELD_LABELS: Record<string, string> = {
  modelId: "Modelo",
  color: "Color",
  storageGb: "Capacidad",
  condition: "Estado del equipo",
  batteryPercent: "Batería",
  imei: "IMEI",
  serialNumber: "Número de serie",
  purchasePrice: "Precio de compra",
  salePrice: "Precio de venta",
  inventoryStatus: "Estado de inventario",
  entryDate: "Fecha de ingreso",
  notes: "Observaciones",
  motivo: "Motivo",
  estado: "Estado",
  rol: "Rol",
  email: "Email",
  firstName: "Nombre",
  lastName: "Apellido",
  name: "Nombre",
  nombre: "Nombre",
  brand: "Marca",
  sku: "Código interno",
  category: "Rubro",
  minStock: "Stock mínimo",
  stock: "Stock",
  stockInicial: "Stock inicial",
  stockAlDarDeBaja: "Stock al dar de baja",
  precio: "Precio",
  total: "Total",
  comprobante: "Comprobante",
  equipos: "Equipos",
  items: "Ítems",
  financiacion: "Financiación",
  recargo: "Recargo por financiación",
  recargoPorcentaje: "Recargo (%)",
  plan: "Plan de financiación",
  equiposDevueltos: "Equipos devueltos",
  accesoriosDevueltos: "Accesorios devueltos",
  equiposIngresados: "Equipos ingresados",
  unidadesDeAccesorios: "Unidades de accesorios",
  montoPactado: "Monto pactado",
  montoCobrado: "Monto cobrado",
  montoRevertido: "Monto revertido",
  venta: "Venta",
  activo: "Activo",
  contraseña: "Contraseña",
  cuit: "CUIT",
  phone: "Teléfono",
  address: "Dirección",
  dni: "DNI",
};

/// Campos cuyo valor se muestra como importe.
const MONEY_FIELDS = new Set([
  "purchasePrice",
  "salePrice",
  "precio",
  "total",
  "recargo",
  "montoPactado",
  "montoCobrado",
  "montoRevertido",
]);

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";

  if (typeof value === "number" && MONEY_FIELDS.has(field)) {
    return formatCurrency(value);
  }

  return String(value);
}

/**
 * Distingue una entrada con forma `{anterior, nuevo}` de un valor suelto.
 *
 * La auditoría es historial inmutable: pueden convivir entradas guardadas con
 * formatos distintos a lo largo del tiempo. Mostrar "—" ante una que no
 * reconocemos sería mentir sobre lo que quedó registrado, así que el valor
 * crudo se muestra igual.
 */
function isChangePair(value: unknown): value is { anterior: unknown; nuevo: unknown } {
  return typeof value === "object" && value !== null && "nuevo" in value;
}

export function ChangeList({
  changes,
}: {
  changes: AuditChanges | Record<string, unknown> | null | undefined;
}) {
  if (!changes || Object.keys(changes).length === 0) return null;

  return (
    <ul className="space-y-1">
      {Object.entries(changes).map(([field, raw]) => {
        if (!isChangePair(raw)) {
          // Entrada en formato plano: se muestra el valor tal cual quedó.
          return (
            <li key={field} className="text-[13px] text-fg-secondary">
              <span className="text-fg-tertiary">{fieldLabel(field)}:</span>{" "}
              <span className="text-fg">{formatValue(field, raw)}</span>
            </li>
          );
        }

        // Cuando no hay valor anterior (un alta), mostrar "— → valor" es ruido:
        // alcanza con el valor nuevo.
        const hadPrevious = raw.anterior !== null && raw.anterior !== undefined;

        return (
          <li key={field} className="text-[13px] text-fg-secondary">
            <span className="text-fg-tertiary">{fieldLabel(field)}:</span>{" "}
            {hadPrevious ? (
              <>
                <span className="line-through">{formatValue(field, raw.anterior)}</span>{" "}
                <span aria-label="cambió a">→</span>{" "}
              </>
            ) : null}
            <span className="text-fg">{formatValue(field, raw.nuevo)}</span>
          </li>
        );
      })}
    </ul>
  );
}
