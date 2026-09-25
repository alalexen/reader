import { recognizeHebrewText } from "./services/ocrService.js";
import {
  getHebrewVoices,
  getPreferredHebrewVoice,
  onVoicesChanged,
  speakHebrew,
  stopSpeech,
} from "./services/speechService.js";
import { translateIntoLanguages } from "./services/translationService.js";
import {
  buildReversoContextUrl,
  fetchReversoExamples,
} from "./services/examplesService.js";
import {
  buildQuizletImportText,
  loadFlashcards,
  removeFlashcard,
  saveFlashcard,
} from "./services/flashcardsService.js";
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
  rememberWordButton: document.querySelector("#rememberWordButton"),
  translateWordButton: document.querySelector("#translateWordButton"),
  translateSentenceButton: document.querySelector("#translateSentenceButton"),
  translationStatus: document.querySelector("#translationStatus"),
  reversoLink: document.querySelector("#reversoLink"),
  examplesResults: document.querySelector("#examplesResults"),
  flashcardsList: document.querySelector("#flashcardsList"),
  flashcardsStatus: document.querySelector("#flashcardsStatus"),
  copyQuizletButton: document.querySelector("#copyQuizletButton"),
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

const state = {
  selectedImage: null,
  activeSentence: "",
  activeWordData: null,
  wordSelectionId: 0,
  preferredVoiceURI: localStorage.getItem("hebrewReaderVoiceURI") || "",
  flashcards: loadFlashcards(),
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

function speak(text) {
  speakHebrew(
    text,
    Number(elements.speechRate.value),
    elements.voiceSelect.value,
  );
}

function renderExamplesPlaceholder(message) {
  elements.examplesResults.replaceChildren();

  const placeholder = document.createElement("p");
  placeholder.className = "reference-placeholder";
  placeholder.textContent = message;
  elements.examplesResults.append(placeholder);
}

function renderReversoExamples(examples) {
  elements.examplesResults.replaceChildren();

  if (!examples.length) {
    renderExamplesPlaceholder(
      "No inline examples were returned. Open Reverso Context to see more.",
    );
    return;
  }

  const list = document.createElement("div");
  list.className = "example-list";

  examples.forEach((example) => {
    const item = document.createElement("article");
    item.className = "example-item";

    const source = document.createElement("p");
    source.className = "example-source";
    source.dir = "rtl";
    source.lang = "he";
    source.textContent = example.source;

    const target = document.createElement("p");
    target.className = "example-target";
    target.lang = "en";
    target.textContent = example.target;

    item.append(source, target);
    list.append(item);
  });

  elements.examplesResults.append(list);
}

function updateRememberButton() {
  const hasSelectedWord = Boolean(state.activeWordData?.word);

  elements.rememberWordButton.disabled = !hasSelectedWord;
  elements.rememberWordButton.title = hasSelectedWord
    ? "Save this word to My flashcards"
    : "Select a Hebrew word first";
}

async function loadReversoExamples(word, selectionId) {
  renderExamplesPlaceholder("Loading Reverso examples...");

  try {
    const examples = await fetchReversoExamples(word, 6);

    if (selectionId !== state.wordSelectionId) {
      return [];
    }

    if (state.activeWordData?.word === word) {
      state.activeWordData.examples = examples;
    }

    renderReversoExamples(examples);
    updateRememberButton();
    return examples;
  } catch (error) {
    console.error("Reverso examples failed:", error);

    if (selectionId !== state.wordSelectionId) {
      return [];
    }

    renderExamplesPlaceholder(
      "Could not load Reverso examples. Check the local server console for the proxy error.",
    );
    updateRememberButton();
    return [];
  }
}

function closeWordPanel() {
  state.wordSelectionId += 1;
  state.activeSentence = "";
  state.activeWordData = null;
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
  state.activeWordData = {
    word,
    sentence: state.activeSentence,
    translations: null,
    examples: [],
  };

  elements.selectedSentence.textContent = state.activeSentence;
  elements.reversoLink.href = buildReversoContextUrl(word);
  updateRememberButton();

  setTranslationPlaceholders("word");
  setTranslationPlaceholders("sentence");
  elements.translationStatus.textContent = "Loading word details...";
  elements.wordPanel.classList.remove("hidden");

  await Promise.allSettled([
    translate(word, "word", selectionId),
    loadReversoExamples(word, selectionId),
  ]);

  updateRememberButton();
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
    return null;
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
      return null;
    }

    Object.entries(translations).forEach(([languageCode, translatedText]) => {
      translationElements[scope][languageCode].textContent = translatedText;
    });

    if (isWordTranslation && state.activeWordData?.word === text.trim()) {
      state.activeWordData.translations = translations;
      updateRememberButton();
    }

    elements.translationStatus.textContent = isWordTranslation
      ? "Word details loaded."
      : "Sentence translated.";

    return translations;
  } catch (error) {
    console.error("Translation failed:", error);

    if (
      isWordTranslation &&
      selectionId !== null &&
      selectionId !== state.wordSelectionId
    ) {
      return null;
    }

    elements.translationStatus.textContent =
      "Translation failed. Please try again in a moment.";
    return null;
  } finally {
    elements.translateWordButton.disabled = false;
    elements.translateSentenceButton.disabled = false;
  }
}

function createFlashcardElement(card) {
  const article = document.createElement("article");
  article.className = "saved-flashcard";

  const header = document.createElement("div");
  header.className = "saved-flashcard-header";

  const word = document.createElement("strong");
  word.className = "saved-flashcard-word";
  word.dir = "rtl";
  word.lang = "he";
  word.textContent = card.word;

  const actions = document.createElement("div");
  actions.className = "inline-actions";

  const speakWordButton = document.createElement("button");
  speakWordButton.type = "button";
  speakWordButton.className = "secondary";
  speakWordButton.textContent = "Speak word";
  speakWordButton.addEventListener("click", () => speak(card.word));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "secondary danger-button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => {
    state.flashcards = removeFlashcard(card.id);
    renderFlashcards();
  });

  actions.append(speakWordButton, deleteButton);
  header.append(word, actions);

  const translations = document.createElement("div");
  translations.className = "saved-translations";
  translations.innerHTML = `
    <span><b>EN</b> ${escapeText(card.translations?.en || "—")}</span>
    <span><b>RU</b> ${escapeText(card.translations?.ru || "—")}</span>
    <span><b>UK</b> ${escapeText(card.translations?.uk || "—")}</span>
  `;

  const example = document.createElement("div");
  example.className = "saved-example";
  const exampleLabel = document.createElement("span");
  exampleLabel.className = "saved-label";
  exampleLabel.textContent = "Reverso example";
  const exampleSource = document.createElement("p");
  exampleSource.dir = "rtl";
  exampleSource.lang = "he";
  exampleSource.textContent = card.example?.source || "—";
  const exampleTarget = document.createElement("p");
  exampleTarget.textContent = card.example?.target || "";
  example.append(exampleLabel, exampleSource, exampleTarget);

  const sourceSentence = document.createElement("div");
  sourceSentence.className = "saved-example";
  const sentenceLabel = document.createElement("span");
  sentenceLabel.className = "saved-label";
  sentenceLabel.textContent = "From your text";
  const sentenceText = document.createElement("p");
  sentenceText.dir = "rtl";
  sentenceText.lang = "he";
  sentenceText.textContent = card.sentence || "—";

  const speakSentenceButton = document.createElement("button");
  speakSentenceButton.type = "button";
  speakSentenceButton.className = "secondary compact-button";
  speakSentenceButton.textContent = "Speak sentence";
  speakSentenceButton.addEventListener("click", () => speak(card.sentence));

  sourceSentence.append(sentenceLabel, sentenceText, speakSentenceButton);
  article.append(header, translations, example, sourceSentence);

  return article;
}

/**
 * Escapes text before it is inserted into the small translation summary HTML.
 */
function escapeText(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function renderFlashcards() {
  elements.flashcardsList.replaceChildren();

  if (!state.flashcards.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "No saved words yet.";
    elements.flashcardsList.append(emptyState);
    elements.copyQuizletButton.disabled = true;
    return;
  }

  state.flashcards.forEach((card) => {
    elements.flashcardsList.append(createFlashcardElement(card));
  });

  elements.copyQuizletButton.disabled = false;
}

async function rememberActiveWord() {
  const data = state.activeWordData;

  if (!data?.word) {
    return;
  }

  elements.rememberWordButton.disabled = true;
  elements.rememberWordButton.textContent = "Saving...";

  try {
    if (!data.translations) {
      const translations = await translate(
        data.word,
        "word",
        state.wordSelectionId,
      );

      if (translations) {
        data.translations = translations;
      }
    }

    if (!data.examples?.length) {
      try {
        data.examples = await fetchReversoExamples(data.word, 6);
        renderReversoExamples(data.examples);
      } catch (error) {
        console.error("Could not add a Reverso example to flashcard:", error);
      }
    }

    state.flashcards = saveFlashcard({
      word: data.word,
      translations: data.translations || {
        uk: "—",
        en: "—",
        ru: "—",
      },
      example: data.examples?.[0] || null,
      sentence: data.sentence,
    });

    renderFlashcards();

    const savedWithExample = Boolean(data.examples?.length);
    elements.translationStatus.textContent = savedWithExample
      ? "Word saved to My flashcards."
      : "Word saved. Reverso example could not be added right now.";

    elements.flashcardsStatus.textContent = `Saved ${data.word}.`;
  } finally {
    elements.rememberWordButton.textContent = "Remember word";
    updateRememberButton();
  }
}

async function copyQuizletImport() {
  const text = buildQuizletImportText(state.flashcards);

  if (!text) {
    elements.flashcardsStatus.textContent = "Save at least one word first.";
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    elements.flashcardsStatus.textContent =
      "Quizlet import text copied. Open Quizlet, create a set, choose Import, and paste it.";
  } catch (error) {
    console.error("Could not copy Quizlet import text:", error);
    elements.flashcardsStatus.textContent =
      "Could not copy automatically. Try again from a secure localhost tab.";
  }
}

function clearApp() {
  stopSpeech();

  if (elements.imagePreview.src) {
    URL.revokeObjectURL(elements.imagePreview.src);
  }

  state.selectedImage = null;
  state.activeSentence = "";
  state.activeWordData = null;
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
  speak(elements.editableText.value);
});

elements.stopButton.addEventListener("click", stopSpeech);
elements.speakWordButton.addEventListener("click", () => speak(elements.selectedWord.textContent));
elements.speakSentenceButton.addEventListener("click", () => speak(state.activeSentence));
elements.rememberWordButton.addEventListener("click", rememberActiveWord);

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

elements.copyQuizletButton.addEventListener("click", copyQuizletImport);

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
renderFlashcards();
renderClickableText();
