const imageInput = document.querySelector("#imageInput");
const imagePreview = document.querySelector("#imagePreview");
const recognizeButton = document.querySelector("#recognizeButton");
const clearButton = document.querySelector("#clearButton");
const ocrStatus = document.querySelector("#ocrStatus");
const ocrProgress = document.querySelector("#ocrProgress");
const editableText = document.querySelector("#editableText");
const renderButton = document.querySelector("#renderButton");
const reader = document.querySelector("#reader");
const speakButton = document.querySelector("#speakButton");
const stopButton = document.querySelector("#stopButton");
const speechRate = document.querySelector("#speechRate");
const wordPanel = document.querySelector("#wordPanel");
const selectedWord = document.querySelector("#selectedWord");
const selectedSentence = document.querySelector("#selectedSentence");
const speakWordButton = document.querySelector("#speakWordButton");
const translateWordButton = document.querySelector("#translateWordButton");
const translateSentenceButton = document.querySelector("#translateSentenceButton");
const translationStatus = document.querySelector("#translationStatus");

const translationElements = {
  word: {
    uk: document.querySelector("#wordTranslationUk"),
    en: document.querySelector("#wordTranslationEn"),
    ru: document.querySelector("#wordTranslationRu"),
  },
  sentence: {
    uk: document.querySelector("#sentenceTranslationUk"),
    en: document.querySelector("#sentenceTranslationEn"),
    ru: document.querySelector("#sentenceTranslationRu"),
  },
};

const targetLanguages = {
  uk: "Ukrainian",
  en: "English",
  ru: "Russian",
};

const translationCache = new Map();

let selectedImage = null;
let activeSentence = "";

/**
 * Returns true when the token contains at least one Hebrew character.
 */
function containsHebrew(token) {
  return /[\u0590-\u05FF]/u.test(token);
}

/**
 * Removes surrounding punctuation while preserving Hebrew letters and marks.
 */
function normalizeHebrewWord(token) {
  return token.replace(/^[^\u0590-\u05FF]+|[^\u0590-\u05FF]+$/gu, "");
}

/**
 * Splits Hebrew text into sentence-like chunks while keeping punctuation.
 */
function splitIntoSentences(text) {
  return text.match(/[^.!?…\n]+[.!?…]?|\n+/gu) || [text];
}

/**
 * Resets translation result fields to their empty state.
 */
function resetTranslations(scope) {
  Object.values(translationElements[scope]).forEach((element) => {
    element.textContent = "—";
  });
}

/**
 * Updates speech control availability based on the current text.
 */
function updateSpeechButtons() {
  const hasText = editableText.value.trim().length > 0;
  speakButton.disabled = !hasText;
  stopButton.disabled = !hasText;
}

/**
 * Finds a Hebrew voice exposed by the current browser or operating system.
 */
function findHebrewVoice() {
  const voices = window.speechSynthesis.getVoices();

  return (
    voices.find((voice) => voice.lang.toLowerCase() === "he-il") ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("he")) ||
    null
  );
}

/**
 * Speaks Hebrew text with the browser Web Speech API.
 */
function speakHebrew(text) {
  const cleanText = text.trim();

  if (!cleanText) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const hebrewVoice = findHebrewVoice();

  utterance.lang = "he-IL";
  utterance.rate = Number(speechRate.value);

  if (hebrewVoice) {
    utterance.voice = hebrewVoice;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Reads a translation from the cache or requests it from MyMemory.
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

  const url = new URL("https://api.mymemory.translated.net/get");
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
 * Translates one text value into every language shown in the UI.
 */
async function translateIntoAllLanguages(text, scope) {
  if (!text.trim()) {
    return;
  }

  translationStatus.textContent = "Translating...";

  const buttons = [translateWordButton, translateSentenceButton];
  buttons.forEach((button) => {
    button.disabled = true;
  });

  try {
    const entries = Object.keys(targetLanguages);

    const translations = await Promise.all(
      entries.map(async (languageCode) => {
        const translatedText = await translateHebrew(text, languageCode);
        return [languageCode, translatedText];
      }),
    );

    translations.forEach(([languageCode, translatedText]) => {
      translationElements[scope][languageCode].textContent = translatedText;
    });

    translationStatus.textContent = "Translation complete.";
  } catch (error) {
    console.error("Translation failed:", error);
    translationStatus.textContent =
      "Translation failed. Please try again in a moment.";
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
}

/**
 * Activates one clicked Hebrew word and stores its containing sentence.
 */
function activateWord(token, sentence) {
  const word = normalizeHebrewWord(token);

  if (!word) {
    return;
  }

  selectedWord.textContent = word;
  activeSentence = sentence.trim();
  selectedSentence.textContent = activeSentence;

  resetTranslations("word");
  resetTranslations("sentence");
  translationStatus.textContent = "";

  wordPanel.classList.remove("hidden");
}

/**
 * Appends one sentence chunk and makes every Hebrew word inside it clickable.
 */
function appendSentence(sentence) {
  const tokens = sentence.split(/(\s+)/u);

  tokens.forEach((token) => {
    if (/^\s+$/u.test(token) || !containsHebrew(token)) {
      reader.append(document.createTextNode(token));
      return;
    }

    const wordElement = document.createElement("span");
    wordElement.className = "word-token";
    wordElement.tabIndex = 0;
    wordElement.setAttribute("role", "button");
    wordElement.textContent = token;

    const activate = () => {
      activateWord(token, sentence);
    };

    wordElement.addEventListener("click", activate);
    wordElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });

    reader.append(wordElement);
  });
}

/**
 * Converts plain Hebrew text into clickable word spans.
 */
function renderClickableText() {
  const text = editableText.value.trim();

  reader.replaceChildren();

  if (!text) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Your Hebrew text will appear here.";
    reader.append(emptyState);
    wordPanel.classList.add("hidden");
    updateSpeechButtons();
    return;
  }

  splitIntoSentences(text).forEach(appendSentence);
  updateSpeechButtons();
}

/**
 * Runs Hebrew OCR locally in the browser using Tesseract.js.
 */
async function recognizeHebrewText() {
  if (!selectedImage) {
    return;
  }

  recognizeButton.disabled = true;
  ocrProgress.value = 0;
  ocrProgress.classList.remove("hidden");
  ocrStatus.textContent = "Preparing Hebrew OCR...";

  try {
    const result = await Tesseract.recognize(selectedImage, "heb", {
      logger(message) {
        if (typeof message.progress === "number") {
          ocrProgress.value = message.progress;
        }

        if (message.status) {
          const percentage =
            typeof message.progress === "number"
              ? ` ${Math.round(message.progress * 100)}%`
              : "";

          ocrStatus.textContent = `${message.status}${percentage}`;
        }
      },
    });

    editableText.value = result.data.text.trim();
    renderClickableText();
    ocrStatus.textContent =
      "Hebrew text recognized. You can correct it manually if needed.";
  } catch (error) {
    console.error("Hebrew OCR failed:", error);
    ocrStatus.textContent =
      "OCR failed. Check your internet connection and try another image.";
  } finally {
    recognizeButton.disabled = false;
    ocrProgress.classList.add("hidden");
  }
}

imageInput.addEventListener("change", () => {
  const [file] = imageInput.files;

  if (!file) {
    return;
  }

  selectedImage = file;
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.classList.remove("hidden");
  recognizeButton.disabled = false;
  ocrStatus.textContent = "Image loaded. Ready to recognize Hebrew text.";
});

recognizeButton.addEventListener("click", recognizeHebrewText);
renderButton.addEventListener("click", renderClickableText);
editableText.addEventListener("input", updateSpeechButtons);

speakButton.addEventListener("click", () => {
  speakHebrew(editableText.value);
});

stopButton.addEventListener("click", () => {
  window.speechSynthesis.cancel();
});

speakWordButton.addEventListener("click", () => {
  speakHebrew(selectedWord.textContent);
});

translateWordButton.addEventListener("click", () => {
  translateIntoAllLanguages(selectedWord.textContent, "word");
});

translateSentenceButton.addEventListener("click", () => {
  translateIntoAllLanguages(activeSentence, "sentence");
});

clearButton.addEventListener("click", () => {
  window.speechSynthesis.cancel();

  if (imagePreview.src) {
    URL.revokeObjectURL(imagePreview.src);
  }

  selectedImage = null;
  activeSentence = "";
  imageInput.value = "";
  imagePreview.removeAttribute("src");
  imagePreview.classList.add("hidden");
  editableText.value = "";
  recognizeButton.disabled = true;
  ocrStatus.textContent = "";
  ocrProgress.value = 0;
  ocrProgress.classList.add("hidden");
  wordPanel.classList.add("hidden");
  resetTranslations("word");
  resetTranslations("sentence");
  renderClickableText();
});

window.speechSynthesis.addEventListener?.("voiceschanged", () => {
  findHebrewVoice();
});

renderClickableText();
