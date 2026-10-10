/**
 * Control anti-duplicados de mensajes.
 *
 * Antes de enviar se compara el texto con todo lo que ya se le mandó a esa
 * persona. Se bloquea si es idéntico (después de normalizar mayúsculas, tildes
 * y signos) o casi idéntico.
 */

/// Minúsculas, sin tildes, sin signos y con espacios colapsados.
export function normalizeMessage(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const DEFAULT_SIMILARITY_THRESHOLD = 0.9;

/// Debajo de este largo (ya normalizado) no se mide similitud: "Perfecto,
/// gracias" puede repetirse sin problema.
export const MIN_LENGTH_FOR_SIMILARITY = 25;

export interface PreviousMessage {
  id: string;
  normalizedText: string;
  createdAt: Date;
  body: string;
}

export interface DuplicateMatch {
  kind: "exact" | "similar";
  /// 1 = idéntico.
  score: number;
  previous: PreviousMessage;
}

function bigrams(text: string): Map<string, number> {
  const map = new Map<string, number>();
  const padded = ` ${text} `;
  for (let i = 0; i < padded.length - 1; i++) {
    const gram = padded.slice(i, i + 2);
    map.set(gram, (map.get(gram) ?? 0) + 1);
  }
  return map;
}

/// Coeficiente de Dice sobre bigramas: 1 si son iguales, 0 si no comparten nada.
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const ga = bigrams(a);
  const gb = bigrams(b);
  let overlap = 0;
  for (const [gram, count] of ga) overlap += Math.min(count, gb.get(gram) ?? 0);

  const total =
    [...ga.values()].reduce((sum, n) => sum + n, 0) +
    [...gb.values()].reduce((sum, n) => sum + n, 0);
  return (2 * overlap) / total;
}

/// Devuelve el mensaje anterior más parecido si el nuevo cuenta como repetido.
export function findDuplicate(
  text: string,
  previous: readonly PreviousMessage[],
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
): DuplicateMatch | null {
  const normalized = normalizeMessage(text);
  if (normalized.length === 0) return null;

  let best: DuplicateMatch | null = null;
  for (const candidate of previous) {
    if (candidate.normalizedText === normalized) {
      // Idénticos: se bloquea siempre, salvo que sea una cortesía muy breve.
      if (normalized.length >= MIN_LENGTH_FOR_SIMILARITY) {
        return { kind: "exact", score: 1, previous: candidate };
      }
      continue;
    }

    if (
      normalized.length < MIN_LENGTH_FOR_SIMILARITY ||
      candidate.normalizedText.length < MIN_LENGTH_FOR_SIMILARITY
    ) {
      continue;
    }

    const score = similarity(normalized, candidate.normalizedText);
    if (score >= threshold && (!best || score > best.score)) {
      best = { kind: "similar", score, previous: candidate };
    }
  }
  return best;
}
