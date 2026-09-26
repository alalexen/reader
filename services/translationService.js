const translationCache = new Map();
const TRANSLATION_ENDPOINT = "https://api.mymemory.translated.net/get";

function containsHebrew(text) {
  return /[\u0590-\u05FF]/u.test(text);
}

async function requestMyMemoryTranslation(text, sourceLanguage, targetLanguage) {
  const cacheKey = `mymemory:${sourceLanguage}:${targetLanguage}:${text}`;

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

async function translateWithMyMemory(text, targetLanguage) {
  const cleanText = text.trim();

  if (!cleanText) {
    return "";
  }

  if (targetLanguage === "en") {
    return requestMyMemoryTranslation(cleanText, "he", "en");
  }

  try {
    const directTranslation = await requestMyMemoryTranslation(
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

  const englishTranslation = await requestMyMemoryTranslation(cleanText, "he", "en");
  return requestMyMemoryTranslation(englishTranslation, "en", targetLanguage);
}

async function translateWithGoogle(text, targetLanguage) {
  const cacheKey = `google-nmt:he:${targetLanguage}:${text}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  const response = await fetch("/api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      text,
      target: targetLanguage,
    }),
  });

  if (!response.ok) {
    let detail = "Google Translation is unavailable.";

    try {
      const body = await response.json();
      detail = body.error || detail;
    } catch {
      // Keep the generic error.
    }

    throw new Error(detail);
  }

  const data = await response.json();
  const translatedText = data?.text?.trim();

  if (!translatedText) {
    throw new Error("Google Translation returned an empty result.");
  }

  translationCache.set(cacheKey, translatedText);
  return translatedText;
}

/**
 * Translates Hebrew into multiple target languages.
 * Google NMT falls back to MyMemory when the local Google backend is unavailable.
 */
export async function translateIntoLanguages(
  text,
  targetLanguages,
  provider = "google-nmt",
) {
  const cleanText = text.trim();

  const entries = await Promise.all(
    targetLanguages.map(async (languageCode) => {
      let translatedText;

      if (provider === "mymemory") {
        translatedText = await translateWithMyMemory(cleanText, languageCode);
      } else {
        try {
          translatedText = await translateWithGoogle(cleanText, languageCode);
        } catch (error) {
          console.warn("Google Translation failed, using MyMemory:", error);
          translatedText = await translateWithMyMemory(cleanText, languageCode);
        }
      }

      return [languageCode, translatedText];
    }),
  );

  return Object.fromEntries(entries);
}
