import { recognizeHebrewText } from "./services/ocrService.js";
import { analyzeHebrewWord } from "./services/morphologyService.js";
import { speakHebrew, stopSpeech } from "./services/speechService.js";
import { translateIntoLanguages } from "./services/translationService.js";
import {
  containsHebrew,
  normalizeHebrewWord,
  splitIntoSentences,
} from "./utils/hebrew.js";

const elements = {
  imageInput: document.querySelector("#imageInput"),
  imagePreview: document.querySelector("#imagePreview"),
  recognizeButton: document.querySelector("#recognizeButton"),
  clearButton: document.querySelector("#clearButton"),
  ocrStatus: document.querySelector("#ocrStatus"),
  ocrProgress: document.querySelector("#ocrProgress"),
  editableText: document.querySelector("#editableText"),
  renderButton: document.querySelector("#renderButton"),
  reader: document.querySelector("#reader"),
  speakButton: document.querySelector("#speakButton"),
  stopButton: document.querySelector("#stopButton"),
  speechRate: document.querySelector("#speechRate"),
  wordPanel: document.querySelector("#wordPanel"),
  selectedWord: document.querySelector("#selectedWord"),
  selectedSentence: document.querySelector("#selectedSentence"),
  speakWordButton: document.querySelector("#speakWordButton"),
  translateWordButton: document.querySelector("#translateWordButton"),
  translateSentenceButton: document.querySelector("#translateSentenceButton"),
  translationStatus: document.querySelector("#translationStatus"),
  morphologySource: document.querySelector("#morphologySource"),
  morphologyNote: document.querySelector("#morphologyNote"),
};

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

const morphologyElements = {
  lemma: document.querySelector("#morphologyLemma"),
  infinitive: document.querySelector("#morphologyInfinitive"),
  root: document.querySelector("#morphologyRoot"),
  partOfSpeech: document.querySelector("#morphologyPartOfSpeech"),
  binyan: document.querySelector("#morphologyBinyan"),
  tense: document.querySelector("#morphologyTense"),
  person: document.querySelector("#morphologyPerson"),
  gender: document.querySelector("#morphologyGender"),
  number: document.querySelector("#morphologyNumber"),
};

const state = {
  selectedImage: null,
  activeSentence: "",
  wordSelectionId: 0,
};

function setTranslationPlaceholders(scope) {
  Object.values(translationElements[scope]).forEach((element) => {
    element.textContent = "—";
  });
}

function updateSpeechButtons() {
  const hasText = elements.editableText.value.trim().length > 0;
  elements.speakButton.disabled = !hasText;
  elements.stopButton.disabled = !hasText;
}

function renderMorphology(word) {
  const analysis = analyzeHebrewWord(word);

  Object.entries(morphologyElements).forEach(([key, element]) => {
    element.textContent = analysis[key] || "—";
  });

  elements.morphologySource.textContent =
    analysis.source === "lexicon" ? "Local lexicon" : "Limited analysis";

  elements.morphologyNote.textContent = analysis.note || "";
}

async function activateWord(token, sentence) {
  const word = normalizeHebrewWord(token);

  if (!word) {
    return;
  }

  const selectionId = ++state.wordSelectionId;

  elements.selectedWord.textContent = word;
  state.activeSentence = sentence.trim();
  elements.selectedSentence.textContent = state.activeSentence;

  setTranslationPlaceholders("word");
  setTranslationPlaceholders("sentence");
  elements.translationStatus.textContent = "Translating selected word...";
  renderMorphology(word);

  elements.wordPanel.classList.remove("hidden");
  await translate(word, "word", selectionId);
}

function appendSentence(sentence) {
  const tokens = sentence.split(/(\s+)/u);

  tokens.forEach((token) => {
    if (/^\s+$/u.test(token) || !containsHebrew(token)) {
      elements.reader.append(document.createTextNode(token));
      return;
    }

    const wordElement = document.createElement("span");
    wordElement.className = "word-token";
    wordElement.tabIndex = 0;
    wordElement.setAttribute("role", "button");
    wordElement.textContent = token;

    const activate = () => activateWord(token, sentence);

    wordElement.addEventListener("click", activate);
    wordElement.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });

    elements.reader.append(wordElement);
  });
}

function renderClickableText() {
  const text = elements.editableText.value.trim();
  elements.reader.replaceChildren();

  if (!text) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Your Hebrew text will appear here.";
    elements.reader.append(emptyState);
    elements.wordPanel.classList.add("hidden");
    updateSpeechButtons();
    return;
  }

  splitIntoSentences(text).forEach(appendSentence);
  updateSpeechButtons();
}

async function runOcr() {
  if (!state.selectedImage) {
    return;
  }

  elements.recognizeButton.disabled = true;
  elements.ocrProgress.value = 0;
  elements.ocrProgress.classList.remove("hidden");

  try {
    const text = await recognizeHebrewText(state.selectedImage, (status, progress) => {
      const percentage =
        typeof progress === "number" ? ` ${Math.round(progress * 100)}%` : "";

      if (typeof progress === "number") {
        elements.ocrProgress.value = progress;
      }

      elements.ocrStatus.textContent = `${status || "Processing"}${percentage}`;
    });

    elements.editableText.value = text;
    renderClickableText();
    elements.ocrStatus.textContent =
      "Hebrew text recognized. You can correct it manually if needed.";
  } catch (error) {
    console.error("Hebrew OCR failed:", error);
    elements.ocrStatus.textContent =
      "OCR failed. Check your internet connection and try another image.";
  } finally {
    elements.recognizeButton.disabled = false;
    elements.ocrProgress.classList.add("hidden");
  }
}

async function translate(text, scope, selectionId = null) {
  if (!text.trim()) {
    return;
  }

  const isWordTranslation = scope === "word";

  elements.translationStatus.textContent = isWordTranslation
    ? "Translating selected word..."
    : "Translating sentence...";
  elements.translateWordButton.disabled = true;
  elements.translateSentenceButton.disabled = true;

  try {
    const translations = await translateIntoLanguages(text, ["uk", "en", "ru"]);

    if (
      isWordTranslation &&
      selectionId !== null &&
      selectionId !== state.wordSelectionId
    ) {
      return;
    }

    Object.entries(translations).forEach(([languageCode, translatedText]) => {
      translationElements[scope][languageCode].textContent = translatedText;
    });

    elements.translationStatus.textContent = isWordTranslation
      ? "Word translated."
      : "Sentence translated.";
  } catch (error) {
    console.error("Translation failed:", error);
    elements.translationStatus.textContent =
      "Translation failed. Please try again in a moment.";
  } finally {
    elements.translateWordButton.disabled = false;
    elements.translateSentenceButton.disabled = false;
  }
}

function clearApp() {
  stopSpeech();

  if (elements.imagePreview.src) {
    URL.revokeObjectURL(elements.imagePreview.src);
  }

  state.selectedImage = null;
  state.activeSentence = "";

  elements.imageInput.value = "";
  elements.imagePreview.removeAttribute("src");
  elements.imagePreview.classList.add("hidden");
  elements.editableText.value = "";
  elements.recognizeButton.disabled = true;
  elements.ocrStatus.textContent = "";
  elements.ocrProgress.value = 0;
  elements.ocrProgress.classList.add("hidden");
  elements.wordPanel.classList.add("hidden");

  setTranslationPlaceholders("word");
  setTranslationPlaceholders("sentence");
  renderClickableText();
}

elements.imageInput.addEventListener("change", () => {
  const [file] = elements.imageInput.files;

  if (!file) {
    return;
  }

  state.selectedImage = file;
  elements.imagePreview.src = URL.createObjectURL(file);
  elements.imagePreview.classList.remove("hidden");
  elements.recognizeButton.disabled = false;
  elements.ocrStatus.textContent = "Image loaded. Ready to recognize Hebrew text.";
});

elements.recognizeButton.addEventListener("click", runOcr);
elements.renderButton.addEventListener("click", renderClickableText);
elements.editableText.addEventListener("input", updateSpeechButtons);

elements.speakButton.addEventListener("click", () => {
  speakHebrew(elements.editableText.value, Number(elements.speechRate.value));
});

elements.stopButton.addEventListener("click", stopSpeech);

elements.speakWordButton.addEventListener("click", () => {
  speakHebrew(elements.selectedWord.textContent, Number(elements.speechRate.value));
});

elements.translateWordButton.addEventListener("click", () => {
  translate(
    elements.selectedWord.textContent,
    "word",
    state.wordSelectionId,
  );
});

elements.translateSentenceButton.addEventListener("click", () => {
  translate(state.activeSentence, "sentence");
});

elements.clearButton.addEventListener("click", clearApp);

renderClickableText();
