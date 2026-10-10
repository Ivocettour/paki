import { useId } from "react";
import type { DeviceType } from "@prisma/client";
import { colorToHex } from "@/lib/colors";
import { cn } from "@/lib/utils";

/**
 * Ilustración del equipo, dibujada en SVG con el color real del producto.
 *
 * El inventario no guarda fotos, así que la tienda dibuja cada equipo según su
 * tipo y su color. Es liviano, nítido en cualquier pantalla y no depende de
 * archivos externos. Cuando haya fotos reales, este es el único componente a
 * reemplazar.
 */

const mix = (hex: string, with_: string, pct: number) =>
  `color-mix(in srgb, ${hex} ${100 - pct}%, ${with_} ${pct}%)`;

export function DeviceArt({
  type,
  color,
  className,
  label,
}: {
  type: DeviceType;
  color: string;
  className?: string;
  /// Texto alternativo. Sin él la ilustración se oculta a lectores de pantalla.
  label?: string;
}) {
  const id = useId();
  const hex = colorToHex(color);

  const light = mix(hex, "#ffffff", 22);
  const dark = mix(hex, "#000000", 28);
  const edge = mix(hex, "#000000", 42);
  const lensPlate = mix(hex, "#000000", 55);

  return (
    <svg
      viewBox="0 0 200 260"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("h-full w-auto drop-shadow-[0_24px_28px_rgb(0_0_0/0.18)]", className)}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: light }} />
          <stop offset="1" style={{ stopColor: dark }} />
        </linearGradient>
        <radialGradient id={`${id}-lens`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#4a5a78" />
          <stop offset="0.45" stopColor="#10131a" />
          <stop offset="1" stopColor="#000000" />
        </radialGradient>
      </defs>

      {type === "TABLET" ? (
        <>
          <rect x="18" y="22" width="164" height="216" rx="20" fill={`url(#${id}-body)`} stroke={edge} strokeWidth="1.5" />
          <rect x="30" y="34" width="38" height="38" rx="11" fill={lensPlate} />
          <circle cx="45" cy="49" r="7" fill={`url(#${id}-lens)`} />
          <circle cx="58" cy="62" r="4.5" fill={`url(#${id}-lens)`} />
        </>
      ) : type === "RELOJ" ? (
        <>
          <rect x="72" y="8" width="56" height="70" rx="14" fill={mix(hex, "#000000", 35)} />
          <rect x="72" y="182" width="56" height="70" rx="14" fill={mix(hex, "#000000", 35)} />
          <rect x="52" y="64" width="96" height="122" rx="30" fill={`url(#${id}-body)`} stroke={edge} strokeWidth="1.5" />
          <rect x="62" y="74" width="76" height="102" rx="22" fill="#0b0b0d" />
          <rect x="150" y="104" width="6" height="22" rx="3" fill={edge} />
          <text x="100" y="134" textAnchor="middle" fontSize="22" fontWeight="300" fill="#f5f5f7" fontFamily="system-ui, sans-serif">
            10:09
          </text>
        </>
      ) : type === "PARLANTE" ? (
        <>
          <rect x="52" y="54" width="96" height="156" rx="46" fill={`url(#${id}-body)`} stroke={edge} strokeWidth="1.5" />
          {[88, 110, 132, 154].map((y) =>
            [76, 94, 112, 130].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill={edge} opacity="0.55" />
            )),
          )}
          <rect x="84" y="186" width="32" height="6" rx="3" fill={edge} opacity="0.7" />
        </>
      ) : type === "CAMARA" ? (
        <>
          <rect x="20" y="78" width="160" height="110" rx="16" fill={`url(#${id}-body)`} stroke={edge} strokeWidth="1.5" />
          <rect x="62" y="62" width="44" height="22" rx="6" fill={dark} />
          <circle cx="100" cy="133" r="40" fill={lensPlate} />
          <circle cx="100" cy="133" r="32" fill={`url(#${id}-lens)`} />
          <circle cx="100" cy="133" r="12" fill="#05070b" />
          <circle cx="156" cy="98" r="6" fill={edge} opacity="0.7" />
        </>
      ) : type === "OTRO" ? (
        <>
          <rect x="34" y="60" width="132" height="140" rx="22" fill={`url(#${id}-body)`} stroke={edge} strokeWidth="1.5" />
          <rect x="60" y="92" width="80" height="12" rx="6" fill={edge} opacity="0.45" />
          <rect x="60" y="116" width="56" height="12" rx="6" fill={edge} opacity="0.3" />
        </>
      ) : (
        <>
          {/* Celular, visto desde atrás. */}
          <rect x="44" y="8" width="112" height="244" rx="26" fill={`url(#${id}-body)`} stroke={edge} strokeWidth="1.5" />
          <rect x="54" y="18" width="56" height="62" rx="15" fill={lensPlate} />
          <circle cx="72" cy="36" r="9" fill={`url(#${id}-lens)`} stroke="#1c1f27" strokeWidth="1.5" />
          <circle cx="72" cy="62" r="9" fill={`url(#${id}-lens)`} stroke="#1c1f27" strokeWidth="1.5" />
          <circle cx="96" cy="49" r="9" fill={`url(#${id}-lens)`} stroke="#1c1f27" strokeWidth="1.5" />
          <circle cx="97" cy="28" r="2.4" fill="#e9e3cf" opacity="0.9" />
        </>
      )}
    </svg>
  );
}
