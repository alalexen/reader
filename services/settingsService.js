const STORAGE_KEY = "hebrewReaderSettings";
const LEGACY_VOICE_STORAGE_KEY = "hebrewReaderVoiceURI";

const SUPPORTED_TRANSLATION_LANGUAGES = ["uk", "en", "ru"];

const DEFAULT_SETTINGS = Object.freeze({
  translationProvider: "google-nmt",
  ocrEngine: "tesseract",
  translationLanguages: [...SUPPORTED_TRANSLATION_LANGUAGES],
  voiceURI: "",
});

function normalizeLanguages(value) {
  if (!Array.isArray(value)) {
    return [...DEFAULT_SETTINGS.translationLanguages];
  }

  const uniqueLanguages = [
    ...new Set(value.filter((code) => SUPPORTED_TRANSLATION_LANGUAGES.includes(code))),
  ];

  return uniqueLanguages.length
    ? uniqueLanguages.slice(0, 3)
    : [...DEFAULT_SETTINGS.translationLanguages];
}

/**
 * Loads and validates user preferences stored in the browser.
 */
export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    return {
      translationProvider:
        saved.translationProvider === "mymemory" ? "mymemory" : "google-nmt",
      ocrEngine:
        saved.ocrEngine === "google-vision" ? "google-vision" : "tesseract",
      translationLanguages: normalizeLanguages(saved.translationLanguages),
      voiceURI:
        typeof saved.voiceURI === "string"
          ? saved.voiceURI
          : localStorage.getItem(LEGACY_VOICE_STORAGE_KEY) || "",
    };
  } catch (error) {
    console.warn("Could not load saved settings:", error);
    return {
      ...DEFAULT_SETTINGS,
      translationLanguages: [...DEFAULT_SETTINGS.translationLanguages],
      voiceURI: DEFAULT_SETTINGS.voiceURI,
    };
  }
}

/**
 * Persists already validated settings.
 */
export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  localStorage.removeItem(LEGACY_VOICE_STORAGE_KEY);
}
