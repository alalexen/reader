function requiredElement(selector) {
  const element = document.querySelector(selector);

  if (!element) {
    throw new Error(`Required UI element not found: ${selector}`);
  }

  return element;
}

export const elements = {
  imageInput: requiredElement("#imageInput"),
  imagePreview: requiredElement("#imagePreview"),
  imageWorkspace: requiredElement("#imageWorkspace"),
  imagePreviewFrame: requiredElement("#imagePreviewFrame"),
  cropSelection: requiredElement("#cropSelection"),
  cropControls: requiredElement("#cropControls"),
  useFullImageButton: requiredElement("#useFullImageButton"),
  cropImageButton: requiredElement("#cropImageButton"),
  applyCropButton: requiredElement("#applyCropButton"),
  resetCropButton: requiredElement("#resetCropButton"),
  cancelCropButton: requiredElement("#cancelCropButton"),
  ocrEngine: requiredElement("#ocrEngine"),
  recognizeButton: requiredElement("#recognizeButton"),
  clearButton: requiredElement("#clearButton"),
  ocrStatus: requiredElement("#ocrStatus"),
  ocrProgress: requiredElement("#ocrProgress"),
  textWorkspace: requiredElement("#textWorkspace"),
  editableText: requiredElement("#editableText"),
  renderButton: requiredElement("#renderButton"),
  resizeTextButton: requiredElement("#resizeTextButton"),
  reader: requiredElement("#reader"),
  speakButton: requiredElement("#speakButton"),
  stopButton: requiredElement("#stopButton"),
  speechRate: requiredElement("#speechRate"),
  voiceSelect: requiredElement("#voiceSelect"),
  wordPanel: requiredElement("#wordPanel"),
  closeWordPanelButton: requiredElement("#closeWordPanelButton"),
  selectedWord: requiredElement("#selectedWord"),
  selectedSentence: requiredElement("#selectedSentence"),
  wordStructureSection: requiredElement("#wordStructureSection"),
  wordStructureParts: requiredElement("#wordStructureParts"),
  speakWordButton: requiredElement("#speakWordButton"),
  speakSentenceButton: requiredElement("#speakSentenceButton"),
  rememberWordButton: requiredElement("#rememberWordButton"),
  translateWordButton: requiredElement("#translateWordButton"),
  translateSentenceButton: requiredElement("#translateSentenceButton"),
  translationStatus: requiredElement("#translationStatus"),
  reversoLink: requiredElement("#reversoLink"),
  flashcardsList: requiredElement("#flashcardsList"),
  flashcardsStatus: requiredElement("#flashcardsStatus"),
  copyQuizletButton: requiredElement("#copyQuizletButton"),
  sessionTimer: requiredElement("#sessionTimer"),
  openSettingsButton: requiredElement("#openSettingsButton"),
  closeSettingsButton: requiredElement("#closeSettingsButton"),
  settingsBackdrop: requiredElement("#settingsBackdrop"),
  settingsTranslationProvider: requiredElement("#settingsTranslationProvider"),
  settingsOcrEngine: requiredElement("#settingsOcrEngine"),
  settingsVoiceSelect: requiredElement("#settingsVoiceSelect"),
  saveSettingsButton: requiredElement("#saveSettingsButton"),
  translationLanguageInputs: [
    ...document.querySelectorAll('input[name="translationLanguage"]'),
  ],
};

export const translationElements = {
  word: {
    uk: requiredElement("#wordTranslationUk"),
    en: requiredElement("#wordTranslationEn"),
    ru: requiredElement("#wordTranslationRu"),
  },
  sentence: {
    uk: requiredElement("#sentenceTranslationUk"),
    en: requiredElement("#sentenceTranslationEn"),
    ru: requiredElement("#sentenceTranslationRu"),
  },
};
