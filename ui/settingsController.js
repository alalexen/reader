import { saveSettings } from "../services/settingsService.js";

export function createSettingsController({
  elements,
  state,
  renderFlashcards,
}) {
  function applyTranslationLanguageVisibility() {
    const selected = new Set(state.settings.translationLanguages);

    document.querySelectorAll("[data-language]").forEach((element) => {
      element.classList.toggle(
        "is-hidden",
        !selected.has(element.dataset.language),
      );
    });
  }

  function cloneVoiceOptionsIntoSettings() {
    elements.settingsVoiceSelect.replaceChildren();

    [...elements.voiceSelect.options].forEach((option) => {
      elements.settingsVoiceSelect.append(option.cloneNode(true));
    });

    elements.settingsVoiceSelect.value = elements.voiceSelect.value;
  }

  function getDraftSettings() {
    return {
      translationProvider: elements.settingsTranslationProvider.value,
      ocrEngine: elements.settingsOcrEngine.value,
      translationLanguages: elements.translationLanguageInputs
        .filter((input) => input.checked)
        .map((input) => input.value),
      voiceURI: elements.settingsVoiceSelect.value,
    };
  }

  function updateSaveButton() {
    const draft = getDraftSettings();
    const current = state.settings;
    const hasLanguage = draft.translationLanguages.length > 0;

    elements.saveSettingsButton.disabled =
      !hasLanguage || JSON.stringify(draft) === JSON.stringify(current);
  }

  function open() {
    elements.settingsTranslationProvider.value =
      state.settings.translationProvider;
    elements.settingsOcrEngine.value = state.settings.ocrEngine;
    cloneVoiceOptionsIntoSettings();

    elements.translationLanguageInputs.forEach((input) => {
      input.checked = state.settings.translationLanguages.includes(input.value);
    });

    elements.settingsBackdrop.classList.remove("hidden");
    elements.settingsBackdrop.setAttribute("aria-hidden", "false");
    updateSaveButton();
  }

  function close() {
    elements.settingsBackdrop.classList.add("hidden");
    elements.settingsBackdrop.setAttribute("aria-hidden", "true");
  }

  function isOpen() {
    return !elements.settingsBackdrop.classList.contains("hidden");
  }

  function save() {
    const draft = getDraftSettings();

    if (!draft.translationLanguages.length) {
      return;
    }

    state.settings = draft;
    saveSettings(state.settings);

    elements.ocrEngine.value = draft.ocrEngine;
    elements.voiceSelect.value = draft.voiceURI;

    applyTranslationLanguageVisibility();
    renderFlashcards();
    updateSaveButton();
  }

  return {
    applyTranslationLanguageVisibility,
    cloneVoiceOptionsIntoSettings,
    close,
    isOpen,
    open,
    save,
    updateSaveButton,
  };
}
