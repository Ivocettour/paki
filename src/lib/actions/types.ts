import { toUserMessage } from "@/lib/errors";

/// Resultado uniforme de toda Server Action.
/// Nunca propaga excepciones crudas al cliente.
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function runAction<T>(operation: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const { message, fieldErrors } = toUserMessage(error);
    return { ok: false, error: message, fieldErrors };
  }
}
