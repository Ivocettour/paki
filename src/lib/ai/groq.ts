export class AiError extends Error {
  retryable = false;
}

export function aiMode(): "groq" | "mock" {
  return process.env.AI_PROVIDER !== "mock" && process.env.GROQ_API_KEY ? "groq" : "mock";
}

export function aiModel(): string {
  return process.env.GROQ_MODEL || "openai/gpt-oss-120b";
}

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 25_000;

interface Options {
  maxTokens?: number;
  temperature?: number;
}

async function callOnce(
  system: string,
  user: string,
  { maxTokens = 1200, temperature = 0.5 }: Options,
): Promise<unknown> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: aiModel(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      // Los tokens de razonamiento cuentan dentro del máximo: se deja margen y
      // se pide razonamiento mínimo para que sea rápido.
      max_completion_tokens: maxTokens,
      reasoning_effort: "low",
      include_reasoning: false,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    // 429 y 5xx suelen ser pasajeros: se reintenta una vez. El resto (clave
    // inválida, pedido mal armado) no.
    const error = new AiError(`Groq respondió ${res.status}`);
    error.retryable = res.status === 429 || res.status >= 500;
    throw error;
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiError("La IA devolvió una respuesta vacía");

  try {
    return JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new AiError("La IA no devolvió un JSON válido");
  }
}

/// Pide una respuesta JSON a Groq. Reintenta una vez ante errores pasajeros.
export async function groqJson(system: string, user: string, options: Options = {}): Promise<unknown> {
  try {
    return await callOnce(system, user, options);
  } catch (error) {
    // Un AiError no reintentable (clave inválida, JSON roto) corta acá; un error
    // de red o un timeout sí se reintenta.
    const retryable = error instanceof AiError ? error.retryable : true;
    if (!retryable) throw error;

    await new Promise((resolve) => setTimeout(resolve, 800));
    try {
      return await callOnce(system, user, options);
    } catch (second) {
      throw second instanceof AiError
        ? second
        : new AiError(`No pude comunicarme con la IA (${(second as Error).message})`);
    }
  }
}
