import { recognizeHebrewText } from "./services/ocrService.js";
import { analyzeHebrewWord } from "./services/morphologyService.js";
import {
  getHebrewVoices,
  getPreferredHebrewVoice,
  onVoicesChanged,
  speakHebrew,
  stopSpeech,
} from "./services/speechService.js";
import { translateIntoLanguages } from "./services/translationService.js";
import { buildReversoContextUrl } from "./services/examplesService.js";
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
  voiceSelect: document.querySelector("#voiceSelect"),
  wordPanel: document.querySelector("#wordPanel"),
  closeWordPanelButton: document.querySelector("#closeWordPanelButton"),
  selectedWord: document.querySelector("#selectedWord"),
  selectedSentence: document.querySelector("#selectedSentence"),
  speakWordButton: document.querySelector("#speakWordButton"),
  speakSentenceButton: document.querySelector("#speakSentenceButton"),
  translateWordButton: document.querySelector("#translateWordButton"),
  translateSentenceButton: document.querySelector("#translateSentenceButton"),
  translationStatus: document.querySelector("#translationStatus"),
  morphologySource: document.querySelector("#morphologySource"),
  morphologyNote: document.querySelector("#morphologyNote"),
  reversoLink: document.querySelector("#reversoLink"),
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
  preferredVoiceURI: localStorage.getItem("hebrewReaderVoiceURI") || "",
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

function initializeVoiceSelector() {
  const voices = getHebrewVoices();
  const preferredVoice = getPreferredHebrewVoice();
  const previousSelection =
    state.preferredVoiceURI || preferredVoice?.voiceURI || "";

  elements.voiceSelect.replaceChildren();

  if (!voices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "System Hebrew voice";
    elements.voiceSelect.append(option);
    return;
  }

  voices.forEach((voice, index) => {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent =
      index === 0 ? `${voice.name} · recommended` : voice.name;
    elements.voiceSelect.append(option);
  });

  const matchingVoice = voices.find(
    (voice) => voice.voiceURI === previousSelection,
  );

  elements.voiceSelect.value =
    matchingVoice?.voiceURI || preferredVoice?.voiceURI || voices[0].voiceURI;

  state.preferredVoiceURI = elements.voiceSelect.value;
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

function closeWordPanel() {
  state.wordSelectionId += 1;
  state.activeSentence = "";
  elements.wordPanel.classList.add("hidden");
  elements.translationStatus.textContent = "";
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

  elements.reversoLink.href = buildReversoContextUrl(word);
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
    closeWordPanel();
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
      "Hebrew text recognized. Review the text and correct any OCR mistakes if needed.";
  } catch (error) {
    console.error("Hebrew OCR failed:", error);
    elements.ocrStatus.textContent =
      "OCR failed. Try a sharper photo with the page filling most of the frame.";
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

    if (
      isWordTranslation &&
      selectionId !== null &&
      selectionId !== state.wordSelectionId
    ) {
      return;
    }

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
  state.wordSelectionId += 1;

  elements.imageInput.value = "";
  elements.imagePreview.removeAttribute("src");
  elements.imagePreview.classList.add("hidden");
  elements.editableText.value = "";
  elements.recognizeButton.disabled = true;
  elements.ocrStatus.textContent = "";
  elements.ocrProgress.value = 0;
  elements.ocrProgress.classList.add("hidden");

  setTranslationPlaceholders("word");
  setTranslationPlaceholders("sentence");
  closeWordPanel();
  renderClickableText();
}

/**
 * Moves every monster pupil toward the pointer while keeping it inside the eye.
 */
function initializeMonsterEyes() {
  const eyes = [...document.querySelectorAll(".monster-eye")];

  if (!eyes.length) {
    return;
  }

  const updateEyes = (clientX, clientY) => {
    eyes.forEach((eye) => {
      const pupil = eye.querySelector(".monster-pupil");

      if (!pupil) {
        return;
      }

      const rect = eye.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = clientX - centerX;
      const deltaY = clientY - centerY;
      const distance = Math.hypot(deltaX, deltaY) || 1;

      const maxX = Math.max(2, rect.width * 0.17);
      const maxY = Math.max(2, rect.height * 0.16);
      const normalizedX = deltaX / distance;
      const normalizedY = deltaY / distance;
      const strength = Math.min(distance / 180, 1);

      pupil.style.setProperty(
        "--eye-x",
        `${normalizedX * maxX * strength}px`,
      );
      pupil.style.setProperty(
        "--eye-y",
        `${normalizedY * maxY * strength}px`,
      );
    });
  };

  window.addEventListener("pointermove", (event) => {
    updateEyes(event.clientX, event.clientY);
  });

  window.addEventListener("pointerleave", () => {
    eyes.forEach((eye) => {
      const pupil = eye.querySelector(".monster-pupil");
      pupil?.style.setProperty("--eye-x", "0px");
      pupil?.style.setProperty("--eye-y", "0px");
    });
  });
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
  speakHebrew(
    elements.editableText.value,
    Number(elements.speechRate.value),
    elements.voiceSelect.value,
  );
});

elements.stopButton.addEventListener("click", stopSpeech);

elements.speakWordButton.addEventListener("click", () => {
  speakHebrew(
    elements.selectedWord.textContent,
    Number(elements.speechRate.value),
    elements.voiceSelect.value,
  );
});

elements.speakSentenceButton.addEventListener("click", () => {
  speakHebrew(
    state.activeSentence,
    Number(elements.speechRate.value),
    elements.voiceSelect.value,
  );
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

elements.voiceSelect.addEventListener("change", () => {
  state.preferredVoiceURI = elements.voiceSelect.value;
  localStorage.setItem("hebrewReaderVoiceURI", state.preferredVoiceURI);
});

elements.closeWordPanelButton.addEventListener("click", closeWordPanel);
elements.clearButton.addEventListener("click", clearApp);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeWordPanel();
  }
});

onVoicesChanged(initializeVoiceSelector);
initializeVoiceSelector();
initializeMonsterEyes();
renderClickableText();
