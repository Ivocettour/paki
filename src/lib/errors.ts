/// Errores de dominio con mensajes listos para mostrar al usuario.
/// Nunca exponen detalles internos de base de datos.

export type AppErrorCode =
  | "VALIDACION"
  | "NO_AUTENTICADO"
  | "SIN_PERMISOS"
  | "NO_ENCONTRADO"
  | "CONFLICTO"
  | "REGLA_DE_NEGOCIO";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { status?: number; fieldErrors?: Record<string, string[]> },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? defaultStatus(code);
    this.fieldErrors = options?.fieldErrors;
  }
}

function defaultStatus(code: AppErrorCode): number {
  switch (code) {
    case "VALIDACION":
      return 400;
    case "NO_AUTENTICADO":
      return 401;
    case "SIN_PERMISOS":
      return 403;
    case "NO_ENCONTRADO":
      return 404;
    case "CONFLICTO":
      return 409;
    case "REGLA_DE_NEGOCIO":
      return 422;
  }
}

export const errors = {
  noAutenticado: () =>
    new AppError("NO_AUTENTICADO", "Necesitás iniciar sesión para continuar."),
  sinPermisos: (detalle = "No tenés permisos para realizar esta acción.") =>
    new AppError("SIN_PERMISOS", detalle),
  noEncontrado: (entidad: string) =>
    new AppError("NO_ENCONTRADO", `No se encontró ${entidad}.`),
  conflicto: (mensaje: string) => new AppError("CONFLICTO", mensaje),
  regla: (mensaje: string) => new AppError("REGLA_DE_NEGOCIO", mensaje),
  validacion: (mensaje: string, fieldErrors?: Record<string, string[]>) =>
    new AppError("VALIDACION", mensaje, { fieldErrors }),
};

/// Convierte cualquier excepción en una respuesta segura para el usuario,
/// registrando el detalle técnico solo del lado del servidor.
export function toUserMessage(error: unknown): {
  message: string;
  code: AppErrorCode | "DESCONOCIDO";
  fieldErrors?: Record<string, string[]>;
} {
  if (error instanceof AppError) {
    return { message: error.message, code: error.code, fieldErrors: error.fieldErrors };
  }

  console.error("[error-no-controlado]", error);
  return {
    message: "Ocurrió un error inesperado. Intentá nuevamente en unos instantes.",
    code: "DESCONOCIDO",
  };
}
