const REVERSO_QUERY_ENDPOINT =
  "https://context.reverso.net/bst-query-service";

const examplesCache = new Map();

/**
 * Removes Reverso's HTML highlighting and returns plain text only.
 *
 * Reverso returns example fragments such as <em>word</em>. We intentionally
 * convert that markup to text instead of inserting remote HTML into the page.
 */
function htmlToPlainText(html) {
  const template = document.createElement("template");
  template.innerHTML = html || "";
  return template.content.textContent?.trim() || "";
}

/**
 * Loads Hebrew-English contextual examples from Reverso's undocumented
 * bst-query-service endpoint.
 *
 * This endpoint is unofficial and may change without notice. Callers should
 * always provide a graceful fallback to the normal Reverso Context page.
 */
export async function fetchReversoExamples(word, limit = 6) {
  const cleanWord = word.trim();

  if (!cleanWord) {
    return [];
  }

  if (examplesCache.has(cleanWord)) {
    return examplesCache.get(cleanWord);
  }

  const response = await fetch(REVERSO_QUERY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      source_text: cleanWord,
      target_text: "",
      source_lang: "he",
      target_lang: "en",
      npage: 1,
      mode: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Reverso example request failed with status ${response.status}.`,
    );
  }

  const payload = await response.json();
  const rows = Array.isArray(payload?.list) ? payload.list : [];

  const examples = rows
    .map((row) => ({
      source: htmlToPlainText(row?.s_text),
      target: htmlToPlainText(row?.t_text),
    }))
    .filter((example) => example.source && example.target)
    .slice(0, limit);

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
