"use client";

import { useEffect } from "react";

/**
 * Último recurso: un error que rompió incluso el layout raíz.
 *
 * Reemplaza todo el documento, así que tiene que traer sus propias etiquetas
 * `html` y `body`, y no puede depender de los estilos de la aplicación.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-global]", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f5f7",
          color: "#1d1d1f",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "460px", textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 600, letterSpacing: "-0.02em" }}>
            Algo salió mal
          </h1>

          <p style={{ marginTop: "12px", fontSize: "16px", color: "#6e6e73" }}>
            La aplicación no pudo iniciarse. Volvé a intentarlo; si el problema
            persiste, avisale a quien administre el sistema.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "28px",
              height: "48px",
              padding: "0 28px",
              borderRadius: "999px",
              border: "none",
              backgroundColor: "#0066cc",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>

          {error.digest ? (
            <p style={{ marginTop: "32px", fontSize: "12px", color: "#86868b" }}>
              Código del error: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
