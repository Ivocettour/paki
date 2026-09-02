import { describe, expect, it } from "vitest";
import { buildCsv, csvFileName } from "@/lib/csv";

interface Row {
  nombre: string;
  cantidad: number;
  precio: number;
  fecha: Date;
  activo: boolean;
  nota: string | null;
}

const columns = [
  { header: "Nombre", value: (row: Row) => row.nombre },
  { header: "Cantidad", value: (row: Row) => row.cantidad },
  { header: "Precio", value: (row: Row) => row.precio },
  { header: "Fecha", value: (row: Row) => row.fecha },
  { header: "Activo", value: (row: Row) => row.activo },
  { header: "Nota", value: (row: Row) => row.nota },
];

function baseRow(overrides: Partial<Row> = {}): Row {
  return {
    nombre: "Funda",
    cantidad: 3,
    precio: 1500,
    fecha: new Date(2026, 8, 2, 14, 30),
    activo: true,
    nota: null,
    ...overrides,
  };
}

describe("Generación de CSV", () => {
  it("empieza con BOM, para que Excel lea bien los acentos", () => {
    const csv = buildCsv([baseRow({ nombre: "Cargador rápido ñ" })], columns);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Cargador rápido ñ");
  });

  it("usa punto y coma como separador", () => {
    const csv = buildCsv([], columns);
    const header = csv.slice(1); // sin BOM

    expect(header).toBe("Nombre;Cantidad;Precio;Fecha;Activo;Nota");
  });

  it("usa coma decimal, como espera la configuración regional", () => {
    const csv = buildCsv([baseRow({ precio: 1234.5 })], columns);

    expect(csv).toContain("1234,50");
    // Un entero no lleva decimales de relleno.
    expect(csv).toContain(";3;");
  });

  it("entrecomilla los valores que contienen el separador", () => {
    const csv = buildCsv([baseRow({ nota: "Ingresó; luego se ajustó" })], columns);

    expect(csv).toContain('"Ingresó; luego se ajustó"');
  });

  it("escapa las comillas duplicándolas", () => {
    const csv = buildCsv([baseRow({ nombre: 'Funda "premium"' })], columns);

    expect(csv).toContain('"Funda ""premium"""');
  });

  it("no deja que un salto de línea rompa la fila", () => {
    const csv = buildCsv([baseRow({ nota: "Primera\nSegunda" })], columns);

    // La celda queda entrecomillada, así que el archivo sigue teniendo
    // encabezado + una fila lógica.
    expect(csv).toContain('"Primera\nSegunda"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("escribe los valores nulos como celda vacía", () => {
    const csv = buildCsv([baseRow({ nota: null })], columns);

    expect(csv.endsWith(";")).toBe(true);
  });

  it("formatea fechas de forma legible y booleanos en español", () => {
    const csv = buildCsv([baseRow()], columns);

    expect(csv).toContain("02/09/2026 14:30");
    expect(csv).toContain("Sí");
  });

  it("genera un archivo aunque no haya filas", () => {
    const csv = buildCsv([], columns);
    expect(csv.split("\r\n")).toHaveLength(1);
  });

  it("incluye la fecha en el nombre del archivo", () => {
    expect(csvFileName("ventas")).toMatch(/^ventas-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
