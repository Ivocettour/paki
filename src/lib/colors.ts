/**
 * Color de un equipo a partir del nombre que escribió quien lo cargó.
 *
 * El inventario guarda el color como texto libre ("Titanio natural", "Negro
 * espacial"), así que se busca por palabras clave. Sirve para dibujar el
 * equipo en la tienda y las muestras de color; si no se reconoce, devuelve un
 * gris neutro en lugar de fallar.
 */

const FALLBACK_HEX = "#8e8e93";

/// Orden importa: las claves más específicas van primero.
const COLOR_KEYWORDS: Array<[string, string]> = [
  ["titanio natural", "#b8afa4"],
  ["titanio negro", "#3b3b3d"],
  ["titanio blanco", "#e3e3df"],
  ["titanio azul", "#4a5568"],
  ["titanio", "#b8afa4"],
  ["medianoche", "#1f2430"],
  ["luz estelar", "#f0e6d6"],
  ["starlight", "#f0e6d6"],
  ["grafito", "#4c4c4e"],
  ["space", "#3a3a3c"],
  ["espacial", "#3a3a3c"],
  ["negro", "#1d1d1f"],
  ["black", "#1d1d1f"],
  ["blanco", "#f5f5f0"],
  ["white", "#f5f5f0"],
  ["plata", "#d8d9db"],
  ["silver", "#d8d9db"],
  ["gris", "#8e8e93"],
  ["gray", "#8e8e93"],
  ["grey", "#8e8e93"],
  ["dorado", "#e6c9a0"],
  ["oro", "#e6c9a0"],
  ["gold", "#e6c9a0"],
  ["rosa", "#f2c4ce"],
  ["pink", "#f2c4ce"],
  ["rojo", "#c8283a"],
  ["red", "#c8283a"],
  ["coral", "#f08a7a"],
  ["naranja", "#f28c38"],
  ["orange", "#f28c38"],
  ["amarillo", "#f5dd6a"],
  ["yellow", "#f5dd6a"],
  ["verde", "#4f7a64"],
  ["green", "#4f7a64"],
  ["celeste", "#9ec8e6"],
  ["azul", "#2f5d8a"],
  ["blue", "#2f5d8a"],
  ["violeta", "#9b86c4"],
  ["morado", "#7d5ba6"],
  ["purple", "#9b86c4"],
  ["lila", "#c8b6e2"],
  ["marron", "#7a5a43"],
  ["beige", "#d9c7a8"],
  ["crema", "#efe6d2"],
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

export function colorToHex(name: string): string {
  const normalized = normalize(name);
  const match = COLOR_KEYWORDS.find(([keyword]) => normalized.includes(keyword));
  return match ? match[1] : FALLBACK_HEX;
}
