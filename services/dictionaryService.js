const WIKTIONARY_DEFINITION_ENDPOINT =
  "https://en.wiktionary.org/api/rest_v1/page/definition";

/**
 * Extracts a few readable English definitions from Wiktionary's structured
 * definition response.
 */
function extractDefinitions(payload) {
  const sections =
    payload?.he ||
    payload?.Hebrew ||
    payload?.heb ||
    [];

  const definitions = [];

  sections.forEach((section) => {
    (section?.definitions || []).forEach((definition) => {
      const text = definition?.definition;

      if (typeof text === "string" && text.trim()) {
        definitions.push(text.replace(/<[^>]*>/g, "").trim());
      }
    });
  });

  return [...new Set(definitions)].slice(0, 4);
}

/**
 * Looks up a Hebrew word in English Wiktionary.
 */
export async function lookupHebrewDictionary(word) {
  const cleanWord = word.trim();

  if (!cleanWord) {
    return {
      definitions: [],
      url: "",
    };
  }

  const url =
    `${WIKTIONARY_DEFINITION_ENDPOINT}/${encodeURIComponent(cleanWord)}`;

  const response = await fetch(url);

  if (response.status === 404) {
    return {
      definitions: [],
      url: buildWiktionaryUrl(cleanWord),
    };
  }

  if (!response.ok) {
    throw new Error(
      `Wiktionary request failed with status ${response.status}.`,
    );
  }

  const payload = await response.json();

  return {
    definitions: extractDefinitions(payload),
    url: buildWiktionaryUrl(cleanWord),
  };
}

export function buildWiktionaryUrl(word) {
  return `https://en.wiktionary.org/wiki/${encodeURIComponent(word.trim())}`;
}
