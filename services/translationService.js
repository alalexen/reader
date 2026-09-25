const translationCache = new Map();
const TRANSLATION_ENDPOINT = "https://api.mymemory.translated.net/get";

/**
 * Translates Hebrew text into one target language.
 */
async function translateHebrew(text, targetLanguage) {
  const cleanText = text.trim();

  if (!cleanText) {
    return "";
  }

  const cacheKey = `he:${targetLanguage}:${cleanText}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const byteLength = new TextEncoder().encode(cleanText).length;

  if (byteLength > 500) {
    throw new Error("The selected text is too long for the free translation request.");
  }

  const url = new URL(TRANSLATION_ENDPOINT);
  url.searchParams.set("q", cleanText);
  url.searchParams.set("langpair", `he|${targetLanguage}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Translation request failed with status ${response.status}.`);
  }

  const data = await response.json();
  const translatedText = data?.responseData?.translatedText?.trim();

  if (!translatedText) {
    throw new Error("The translation service returned an empty result.");
  }

  translationCache.set(cacheKey, translatedText);
  return translatedText;
}

/**
 * Translates one Hebrew text value into multiple languages.
 */
export async function translateIntoLanguages(text, targetLanguages) {
  const entries = await Promise.all(
    targetLanguages.map(async (languageCode) => [
      languageCode,
      await translateHebrew(text, languageCode),
    ]),
  );

  return Object.fromEntries(entries);
}
