/**
 * Generación de CSV pensada para abrirse en Excel configurado en español.
 *
 * Dos decisiones que importan en la práctica:
 *
 * 1. **Separador `;`**. En la configuración regional de Argentina la coma es el
 *    separador decimal, así que Excel espera punto y coma entre columnas. Con
 *    comas, todo el archivo cae en una sola columna.
 *
 * 2. **BOM al inicio**. Sin él, Excel interpreta el archivo como ANSI y los
 *    acentos y la "ñ" se ven rotos.
 */

const SEPARATOR = ";";
const BOM = "﻿";

export type CsvValue = string | number | boolean | Date | null | undefined;

/// Escapa un valor para que no rompa la estructura del archivo.
function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    // Fecha y hora legibles, sin depender de la interpretación de Excel.
    return formatDateTime(value);
  }

  if (typeof value === "number") {
    // Decimal con coma, como espera la configuración regional.
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");
  }

  if (typeof value === "boolean") return value ? "Sí" : "No";

  const text = String(value);

  // Se entrecomilla si contiene el separador, comillas o saltos de línea.
  if (text.includes(SEPARATOR) || text.includes('"') || /[\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateTime(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

/// Arma el contenido completo del archivo a partir de las filas y columnas.
export function buildCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines: string[] = [
    columns.map((column) => escapeCell(column.header)).join(SEPARATOR),
  ];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(column.value(row))).join(SEPARATOR));
  }

  // CRLF: es lo que espera Excel en Windows.
  return BOM + lines.join("\r\n");
}

/// Nombre de archivo con la fecha, para no pisar descargas anteriores.
export function csvFileName(base: string): string {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${base}-${stamp}.csv`;
}

export function csvResponse(content: string, fileName: string): Response {
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      // Un reporte nunca debe servirse desde caché: los datos cambian.
      "Cache-Control": "no-store",
    },
  });
}
