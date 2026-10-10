import { z } from "zod";
import { cleanDraftText } from "./clean";
import { AiError, aiMode, aiModel, groqJson } from "./groq";
import { mockClassify, mockClassifyAndDraft, mockRewrite } from "./mock";
import { buildRewritePrompt, buildSystemPrompt, buildUserPrompt } from "./prompt";
import type { DraftInput, DraftResult, RewriteStyle } from "./types";

export { aiMode, aiModel };

const resultSchema = z.object({
  classification: z
    .object({
      interestNote: z.string().nullable().catch(null),
      // Si la IA no manda la prioridad o la manda mal, se completa con las
      // reglas simples: no se rompe el borrador.
      priority: z
        .object({
          level: z.enum(["ALTA", "MEDIA", "BAJA"]),
          reason: z.string().trim().max(200).catch(""),
        })
        .optional()
        .catch(undefined),
    })
    .catch({ interestNote: null }),
  draft: z.string().trim().min(10),
});

/**
 * Clasifica la consulta y arma el borrador. Si la IA falla (sin conexión, clave
 * inválida, respuesta rota) usa la versión simulada y lo deja marcado, para que
 * una consulta nunca se quede sin borrador.
 */
export async function classifyAndDraft(
  input: DraftInput,
): Promise<DraftResult & { warning?: string }> {
  if (aiMode() === "mock") return mockClassifyAndDraft(input);

  // Hasta dos intentos: si el formato de la respuesta sale mal una vez, se pide
  // de nuevo antes de usar el respaldo.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await groqJson(buildSystemPrompt(input), buildUserPrompt(input), {
        maxTokens: 1500,
        temperature: attempt === 1 ? 0.6 : 0.3,
      });
      const parsed = resultSchema.parse(raw);

      return {
        classification: {
          interestNote: parsed.classification.interestNote,
          priority: parsed.classification.priority ?? mockClassify(input).priority,
        },
        draft: cleanDraftText(parsed.draft),
        generatedBy: aiModel(),
      };
    } catch (error) {
      lastError = error;
      const formatProblem =
        error instanceof z.ZodError ||
        (error instanceof AiError && /JSON válido|vacía/.test(error.message));
      if (!formatProblem) break;
      console.error(`[ia] Respuesta con formato inesperado (intento ${attempt} de 2)`);
    }
  }

  const reason =
    lastError instanceof z.ZodError
      ? "La IA devolvió un formato inesperado"
      : lastError instanceof AiError
        ? lastError.message
        : "Error inesperado de la IA";
  console.error("[ia] Falló Groq, se usa el borrador simulado:", reason);

  return { ...mockClassifyAndDraft(input), generatedBy: "mock-respaldo", warning: reason };
}

/// Reescribe un texto (más breve o más formal). Lanza AiError si la IA falla,
/// para no cambiarle el texto a la persona sin avisar.
export async function rewriteText(
  text: string,
  style: RewriteStyle,
  storeName: string,
): Promise<string> {
  if (aiMode() === "mock") return mockRewrite(text, style);

  const { system, user } = buildRewritePrompt(text, style, storeName);
  const raw = await groqJson(system, user, { maxTokens: 1200, temperature: 0.3 });
  const parsed = z.object({ text: z.string().trim().min(5) }).safeParse(raw);
  if (!parsed.success) throw new AiError("La IA no devolvió un texto válido");
  return cleanDraftText(parsed.data.text);
}
