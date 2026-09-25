const translationCache = new Map();
const TRANSLATION_ENDPOINT = "https://api.mymemory.translated.net/get";

function containsHebrew(text) {
  return /[\u0590-\u05FF]/u.test(text);
}

/**
 * Requests one translation pair from MyMemory.
 */
async function requestTranslation(text, sourceLanguage, targetLanguage) {
  const cacheKey = `${sourceLanguage}:${targetLanguage}:${text}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const byteLength = new TextEncoder().encode(text).length;

  if (byteLength > 500) {
    throw new Error("The selected text is too long for the free translation request.");
  }

  const url = new URL(TRANSLATION_ENDPOINT);
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${sourceLanguage}|${targetLanguage}`);

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
 * Translates Hebrew text into one target language.
 *
 * Ukrainian and Russian first use a direct translation. If the free service
 * leaves Hebrew text untranslated, the service retries through English.
 */
async function translateHebrew(text, targetLanguage) {
  const cleanText = text.trim();

  if (!cleanText) {
    return "";
  }

  if (targetLanguage === "en") {
    return requestTranslation(cleanText, "he", "en");
  }

  try {
    const directTranslation = await requestTranslation(
      cleanText,
      "he",
      targetLanguage,
    );

    if (!containsHebrew(directTranslation)) {
      return directTranslation;
    }
  } catch (error) {
    console.warn("Direct translation failed, trying English fallback:", error);
  }

  const englishTranslation = await requestTranslation(cleanText, "he", "en");
  return requestTranslation(englishTranslation, "en", targetLanguage);
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
