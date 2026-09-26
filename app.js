import { loadFlashcards } from "./services/flashcardsService.js";
import {
  loadSettings,
  saveSettings,
} from "./services/settingsService.js";
import { elements, translationElements } from "./ui/elements.js";
import { createFlashcardsController } from "./ui/flashcardsController.js";
import { createImageController } from "./ui/imageController.js";
import { createReaderController } from "./ui/readerController.js";
import { createSettingsController } from "./ui/settingsController.js";
import { createSpeechController } from "./ui/speechController.js";
import { initializeSessionTimer } from "./ui/sessionTimer.js";

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
  readerMode: "edit",
  isTextWorkspaceExpanded: false,
  settings: loadSettings(),
  flashcards: loadFlashcards(),
};

const reader = createReaderController({
  elements,
  translationElements,
  state,
});

const speech = createSpeechController({ elements, state });

const flashcards = createFlashcardsController({
  elements,
  state,
  reader,
  speak: speech.speak,
});

const settings = createSettingsController({
  elements,
  state,
  renderFlashcards: flashcards.renderFlashcards,
});

const image = createImageController({
  elements,
  state,
  reader,
});

function clearApp() {
  speech.stop();
  image.clear();
  reader.clear();
}

elements.imageInput.addEventListener("change", image.handleFileSelection);
elements.useFullImageButton.addEventListener("click", image.useFullImage);
elements.cropImageButton.addEventListener("click", image.enterCropMode);
elements.applyCropButton.addEventListener("click", image.applyImageCrop);
elements.resetCropButton.addEventListener("click", image.resetCropSelection);
elements.cancelCropButton.addEventListener("click", image.cancelCrop);
elements.imagePreviewFrame.addEventListener("pointerdown", image.startCropDrag);
elements.imagePreviewFrame.addEventListener("pointermove", image.moveCropDrag);
elements.imagePreviewFrame.addEventListener("pointerup", image.endCropDrag);
elements.imagePreviewFrame.addEventListener("pointercancel", image.endCropDrag);
elements.recognizeButton.addEventListener("click", image.runOcr);

elements.renderButton.addEventListener("click", () => {
  reader.setReaderMode(state.readerMode === "edit" ? "reader" : "edit");
});
elements.resizeTextButton.addEventListener(
  "click",
  reader.toggleTextWorkspaceSize,
);
elements.editableText.addEventListener(
  "input",
  reader.updateTextWorkspaceControls,
);

elements.speakButton.addEventListener("click", () => {
  speech.speak(elements.editableText.value);
});
elements.stopButton.addEventListener("click", speech.stop);
elements.speakWordButton.addEventListener("click", () => {
  speech.speak(elements.selectedWord.textContent);
});
elements.speakSentenceButton.addEventListener("click", () => {
  speech.speak(state.activeSentence);
});

elements.rememberWordButton.addEventListener(
  "click",
  flashcards.rememberActiveWord,
);
elements.copyQuizletButton.addEventListener(
  "click",
  flashcards.copyQuizletImport,
);

elements.translateWordButton.addEventListener("click", () => {
  reader.translate(
    elements.selectedWord.textContent,
    "word",
    state.wordSelectionId,
  );
});
elements.translateSentenceButton.addEventListener("click", () => {
  reader.translate(state.activeSentence, "sentence");
});

elements.closeWordPanelButton.addEventListener("click", reader.closeWordPanel);
elements.clearButton.addEventListener("click", clearApp);

elements.openSettingsButton.addEventListener("click", settings.open);
elements.closeSettingsButton.addEventListener("click", settings.close);
elements.saveSettingsButton.addEventListener("click", settings.save);

[
  elements.settingsTranslationProvider,
  elements.settingsOcrEngine,
  elements.settingsVoiceSelect,
  ...elements.translationLanguageInputs,
].forEach((control) => {
  control.addEventListener("change", settings.updateSaveButton);
});

elements.ocrEngine.addEventListener("change", () => {
  state.settings.ocrEngine = elements.ocrEngine.value;
  saveSettings(state.settings);

  if (settings.isOpen()) {
    elements.settingsOcrEngine.value = elements.ocrEngine.value;
    settings.updateSaveButton();
  }
});

elements.voiceSelect.addEventListener("change", () => {
  state.settings.voiceURI = elements.voiceSelect.value;
  saveSettings(state.settings);

  if (settings.isOpen()) {
    settings.cloneVoiceOptionsIntoSettings();
    settings.updateSaveButton();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") {
    return;
  }

  if (settings.isOpen()) {
    settings.close();
    return;
  }

  reader.closeWordPanel();
});

speech.watchVoiceChanges();

elements.ocrEngine.value = state.settings.ocrEngine;
settings.applyTranslationLanguageVisibility();
speech.initializeVoiceSelector();
initializeSessionTimer(elements.sessionTimer);
flashcards.renderFlashcards();
reader.setReaderMode("edit");
reader.updateTextWorkspaceControls();
