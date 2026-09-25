const examplesCache = new Map();

/**
 * Loads Hebrew-English contextual examples through the local development
 * server. The local proxy is needed because Reverso's undocumented endpoint
 * does not reliably allow browser cross-origin requests.
 */
export async function fetchReversoExamples(word, limit = 6) {
  const cleanWord = word.trim();

  if (!cleanWord) {
    return [];
  }

  if (examplesCache.has(cleanWord)) {
    return examplesCache.get(cleanWord);
  }

  const url = new URL("/api/reverso", window.location.origin);
  url.searchParams.set("word", cleanWord);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Reverso proxy request failed with status ${response.status}.`,
    );
  }

  const payload = await response.json();
  const examples = Array.isArray(payload?.examples) ? payload.examples : [];

  examplesCache.set(cleanWord, examples);
  return examples;
}

/**
 * Builds the normal Reverso Context page URL for the selected Hebrew word.
 */
export function buildReversoContextUrl(word) {
  const cleanWord = word.trim();

  return `https://context.reverso.net/translation/hebrew-english/${encodeURIComponent(cleanWord)}`;
}
