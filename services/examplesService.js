const TATOEBA_ENDPOINT = "https://api.tatoeba.org/v1/sentences";

/**
 * Searches Tatoeba for Hebrew sentences containing the selected word.
 */
export async function findHebrewExamples(word, limit = 5) {
  const cleanWord = word.trim();

  if (!cleanWord) {
    return [];
  }

  const url = new URL(TATOEBA_ENDPOINT);
  url.searchParams.set("lang", "heb");
  url.searchParams.set("q", cleanWord);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Tatoeba request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const rows =
    payload?.data ||
    payload?.results ||
    payload?.sentences ||
    payload?.items ||
    [];

  return rows
    .map((row) => ({
      id: row?.id ?? null,
      text: row?.text || row?.sentence || "",
    }))
    .filter((row) => row.text)
    .slice(0, limit);
}

/**
 * Builds a Reverso Context URL for the selected Hebrew word.
 */
export function buildReversoContextUrl(word) {
  const cleanWord = word.trim();

  return `https://context.reverso.net/translation/hebrew-english/${encodeURIComponent(cleanWord)}`;
}
