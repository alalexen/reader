import { recognizeHebrewText } from "./services/ocrService.js?v=ocr-selector-1";
import {
  getGoogleTtsVoices,
  getHebrewVoices,
  getPreferredHebrewVoice,
  onVoicesChanged,
  speakHebrew,
  stopSpeech,
} from "./services/speechService.js?v=google-wavenet-1";
import { translateIntoLanguages } from "./services/translationService.js";
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
  imageWorkspace: document.querySelector("#imageWorkspace"),
  imagePreviewFrame: document.querySelector("#imagePreviewFrame"),
  cropSelection: document.querySelector("#cropSelection"),
  cropControls: document.querySelector("#cropControls"),
  useFullImageButton: document.querySelector("#useFullImageButton"),
  cropImageButton: document.querySelector("#cropImageButton"),
  applyCropButton: document.querySelector("#applyCropButton"),
  resetCropButton: document.querySelector("#resetCropButton"),
  cancelCropButton: document.querySelector("#cancelCropButton"),
  ocrEngine: document.querySelector("#ocrEngine"),
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
  flashcardsList: document.querySelector("#flashcardsList"),
  flashcardsStatus: document.querySelector("#flashcardsStatus"),
  copyQuizletButton: document.querySelector("#copyQuizletButton"),
  sessionTimer: document.querySelector("#sessionTimer"),
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
  originalImage: null,
  previewUrl: "",
  cropSelection: null,
  isCropping: false,
  cropDragStart: null,
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

async function initializeVoiceSelector() {
  const browserVoices = getHebrewVoices();
  const googleVoices = await getGoogleTtsVoices();
  const preferredVoice = getPreferredHebrewVoice();
  const defaultSystemVoice =
    browserVoices.find((voice) => voice.default) || preferredVoice || null;

  const previousSelection =
    state.preferredVoiceURI || defaultSystemVoice?.voiceURI || "";

  elements.voiceSelect.replaceChildren();

  if (defaultSystemVoice) {
    const option = document.createElement("option");
    option.value = defaultSystemVoice.voiceURI;
    option.textContent = `${defaultSystemVoice.name} · system (default)`;
    elements.voiceSelect.append(option);
  }

  browserVoices
    .filter((voice) => voice.voiceURI !== defaultSystemVoice?.voiceURI)
    .forEach((voice) => {
      const option = document.createElement("option");
      option.value = voice.voiceURI;
      option.textContent = `${voice.name} · system`;
      elements.voiceSelect.append(option);
    });

  googleVoices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.voiceURI;
    option.textContent = `${voice.name} · ${voice.gender}`;
    elements.voiceSelect.append(option);
  });

  if (!browserVoices.length && !googleVoices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "System Hebrew voice (default)";
    elements.voiceSelect.append(option);
  }

  const availableValues = [...elements.voiceSelect.options].map(
    (option) => option.value,
  );

  elements.voiceSelect.value = availableValues.includes(previousSelection)
    ? previousSelection
    : defaultSystemVoice?.voiceURI || availableValues[0] || "";

  state.preferredVoiceURI = elements.voiceSelect.value;
}
async function speak(text) {
  return speakHebrew(
    text,
    Number(elements.speechRate.value),
    elements.voiceSelect.value,
  );
}

function updateRememberButton() {
  const hasSelectedWord = Boolean(state.activeWordData?.word);

  elements.rememberWordButton.disabled = !hasSelectedWord;
  elements.rememberWordButton.title = hasSelectedWord
    ? "Save this word to My flashcards"
    : "Select a Hebrew word first";
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
  };

  elements.selectedSentence.textContent = state.activeSentence;
  elements.reversoLink.href =
    `https://context.reverso.net/translation/hebrew-english/${encodeURIComponent(word)}`;
  updateRememberButton();

  setTranslationPlaceholders("word");
  setTranslationPlaceholders("sentence");
  elements.translationStatus.textContent = "Loading word details...";
  elements.wordPanel.classList.remove("hidden");

  await translate(word, "word", selectionId);
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

function setImagePreview(file) {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
  }

  state.previewUrl = URL.createObjectURL(file);
  elements.imagePreview.src = state.previewUrl;
  elements.imageWorkspace.classList.remove("hidden");
}

function resetCropSelection() {
  state.cropSelection = null;
  state.cropDragStart = null;
  elements.cropSelection.classList.add("hidden");
  elements.cropSelection.removeAttribute("style");
  elements.applyCropButton.disabled = true;
}

function setCropMode(enabled) {
  state.isCropping = enabled;
  state.cropDragStart = null;
  elements.imagePreviewFrame.classList.toggle("is-cropping", enabled);
  elements.cropControls.classList.toggle("hidden", !enabled);

  if (!enabled) {
    resetCropSelection();
  }
}

function getCropPoint(event) {
  const rect = elements.imagePreview.getBoundingClientRect();

  return {
    x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
    y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
    width: rect.width,
    height: rect.height,
  };
}

function updateCropSelection(start, current) {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);

  state.cropSelection = { left, top, width, height };

  Object.assign(elements.cropSelection.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  });

  elements.cropSelection.classList.remove("hidden");
  elements.applyCropButton.disabled = width < 12 || height < 12;
}

function startCropDrag(event) {
  if (!state.isCropping || event.button > 0) {
    return;
  }

  event.preventDefault();
  const point = getCropPoint(event);
  state.cropDragStart = point;
  updateCropSelection(point, point);
  elements.imagePreviewFrame.setPointerCapture?.(event.pointerId);
}

function moveCropDrag(event) {
  if (!state.isCropping || !state.cropDragStart) {
    return;
  }

  event.preventDefault();
  updateCropSelection(state.cropDragStart, getCropPoint(event));
}

function endCropDrag(event) {
  if (!state.cropDragStart) {
    return;
  }

  moveCropDrag(event);
  state.cropDragStart = null;

  if (elements.imagePreviewFrame.hasPointerCapture?.(event.pointerId)) {
    elements.imagePreviewFrame.releasePointerCapture(event.pointerId);
  }
}

function useFullImage() {
  if (!state.originalImage) {
    return;
  }

  setCropMode(false);
  state.selectedImage = state.originalImage;
  setImagePreview(state.originalImage);
  elements.recognizeButton.disabled = false;
  elements.ocrStatus.textContent =
    "Full image selected. Ready to recognize Hebrew text.";
}

async function applyImageCrop() {
  const selection = state.cropSelection;

  if (!selection || !state.selectedImage) {
    return;
  }

  elements.applyCropButton.disabled = true;

  try {
    const bitmap = await createImageBitmap(state.selectedImage);
    const displayedWidth = elements.imagePreview.clientWidth;
    const displayedHeight = elements.imagePreview.clientHeight;
    const scaleX = bitmap.width / displayedWidth;
    const scaleY = bitmap.height / displayedHeight;

    const sourceX = Math.max(0, Math.round(selection.left * scaleX));
    const sourceY = Math.max(0, Math.round(selection.top * scaleY));
    const sourceWidth = Math.min(
      bitmap.width - sourceX,
      Math.max(1, Math.round(selection.width * scaleX)),
    );
    const sourceHeight = Math.min(
      bitmap.height - sourceY,
      Math.max(1, Math.round(selection.height * scaleY)),
    );

    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const context = canvas.getContext("2d");
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight,
    );
    bitmap.close();

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error("Could not create cropped image."));
          }
        },
        "image/png",
      );
    });

    const croppedFile = new File([blob], "cropped-hebrew-page.png", {
      type: "image/png",
    });

    state.selectedImage = croppedFile;
    setCropMode(false);
    setImagePreview(croppedFile);
    elements.recognizeButton.disabled = false;
    elements.ocrStatus.textContent =
      "Crop applied. Ready to recognize Hebrew text.";
  } catch (error) {
    console.error("Could not crop image:", error);
    elements.ocrStatus.textContent =
      "Could not crop this image. You can use the full image instead.";
    elements.applyCropButton.disabled = false;
  }
}

async function runOcr() {
  if (!state.selectedImage) {
    return;
  }

  elements.recognizeButton.disabled = true;
  elements.ocrProgress.value = 0;
  elements.ocrProgress.classList.remove("hidden");

  try {
    const result = await recognizeHebrewText(
      state.selectedImage,
      elements.ocrEngine.value,
      (status, progress) => {
      const percentage =
        typeof progress === "number" ? ` ${Math.round(progress * 100)}%` : "";

      if (typeof progress === "number") {
        elements.ocrProgress.value = progress;
      }

        elements.ocrStatus.textContent = `${status || "Processing"}${percentage}`;
      },
    );

    elements.editableText.value = result.text;
    renderClickableText();
    elements.ocrStatus.textContent =
      result.provider === "google-vision"
        ? "Recognized with Google Vision"
        : "Recognized with local Tesseract (default)";
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
  article.append(header, translations, sourceSentence);

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

    state.flashcards = saveFlashcard({
      word: data.word,
      translations: data.translations || {
        uk: "—",
        en: "—",
        ru: "—",
      },
      sentence: data.sentence,
    });

    renderFlashcards();

    elements.translationStatus.textContent = "Word saved to My flashcards.";

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

  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = "";
  }

  state.selectedImage = null;
  state.originalImage = null;
  state.cropSelection = null;
  state.isCropping = false;
  state.cropDragStart = null;
  state.activeSentence = "";
  state.activeWordData = null;
  state.wordSelectionId += 1;

  elements.imageInput.value = "";
  elements.imagePreview.removeAttribute("src");
  elements.imageWorkspace.classList.add("hidden");
  elements.imagePreviewFrame.classList.remove("is-cropping");
  elements.cropControls.classList.add("hidden");
  resetCropSelection();
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


function initializeSessionTimer() {
  if (!elements.sessionTimer) {
    return;
  }

  const startedAt = Date.now();

  const updateTimer = () => {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - startedAt) / 1000),
    );
    const hours = Math.floor(elapsedSeconds / 3600) % 24;
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const value = [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");

    elements.sessionTimer.textContent = value;
    elements.sessionTimer.dateTime = `PT${elapsedSeconds}S`;
  };

  updateTimer();
  window.setInterval(updateTimer, 1000);
}

elements.imageInput.addEventListener("change", () => {
  const [file] = elements.imageInput.files;

  if (!file) {
    return;
  }

  state.originalImage = file;
  state.selectedImage = file;
  setCropMode(false);
  setImagePreview(file);
  elements.recognizeButton.disabled = false;
  elements.ocrStatus.textContent =
    "Image loaded. Use it as is, or crop it before recognition.";
});

elements.useFullImageButton.addEventListener("click", useFullImage);
elements.cropImageButton.addEventListener("click", () => {
  resetCropSelection();
  setCropMode(true);
  elements.ocrStatus.textContent =
    "Crop mode: drag across the image to select the text area.";
});
elements.applyCropButton.addEventListener("click", applyImageCrop);
elements.resetCropButton.addEventListener("click", resetCropSelection);
elements.cancelCropButton.addEventListener("click", () => {
  setCropMode(false);
  elements.ocrStatus.textContent =
    "Crop cancelled. Current image is ready for recognition.";
});

elements.imagePreviewFrame.addEventListener("pointerdown", startCropDrag);
elements.imagePreviewFrame.addEventListener("pointermove", moveCropDrag);
elements.imagePreviewFrame.addEventListener("pointerup", endCropDrag);
elements.imagePreviewFrame.addEventListener("pointercancel", endCropDrag);

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

onVoicesChanged(() => {
  initializeVoiceSelector();
});
initializeVoiceSelector();
initializeSessionTimer();
renderFlashcards();
renderClickableText();
