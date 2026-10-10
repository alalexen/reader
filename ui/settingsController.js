import { saveSettings } from "../services/settingsService.js";

/** Keeps the existing settings dialog in sync with saved application preferences. */
export function createSettingsController({ elements, state, onThemeChanged = () => {} }) {
  /** Shows only the translation languages selected in settings. */
  function applyTranslationLanguageVisibility() {
    const selected = new Set(state.settings.translationLanguages);

    document.querySelectorAll("[data-language]").forEach((element) => {
      element.classList.toggle(
        "is-hidden",
        !selected.has(element.dataset.language),
      );
    });
  }

  /** Copies available speech voices into the modal without moving the original options. */
  function cloneVoiceOptionsIntoSettings() {
    elements.settingsVoiceSelect.replaceChildren();

    [...elements.voiceSelect.options].forEach((option) => {
      elements.settingsVoiceSelect.append(option.cloneNode(true));
    });

    elements.settingsVoiceSelect.value = elements.voiceSelect.value;
  }

  /** Reads the editable settings fields without mutating persisted preferences. */
  function getDraftSettings() {
    return {
      theme: elements.appearanceInputs.find((input) => input.checked)?.value || state.settings.theme,
      translationProvider: elements.settingsTranslationProvider.value,
      ocrEngine: elements.settingsOcrEngine.value,
      translationLanguages: elements.translationLanguageInputs
        .filter((input) => input.checked)
        .map((input) => input.value),
      voiceURI: elements.settingsVoiceSelect.value,
    };
  }

  /** Disables Save when values are unchanged or no translation language is selected. */
  function updateSaveButton() {
    const draft = getDraftSettings();
    const current = state.settings;
    const hasLanguage = draft.translationLanguages.length > 0;

    elements.saveSettingsButton.disabled =
      !hasLanguage || JSON.stringify(draft) === JSON.stringify(current);
  }

  /** Populates and opens the existing settings modal. */
  function open() {
    elements.settingsTranslationProvider.value =
      state.settings.translationProvider;
    elements.settingsOcrEngine.value = state.settings.ocrEngine;
    cloneVoiceOptionsIntoSettings();
    elements.appearanceInputs.forEach((input) => {
      input.checked = input.value === state.settings.theme;
    });

    elements.translationLanguageInputs.forEach((input) => {
      input.checked = state.settings.translationLanguages.includes(input.value);
    });

    elements.settingsBackdrop.classList.remove("hidden");
    elements.settingsBackdrop.setAttribute("aria-hidden", "false");
    updateSaveButton();
  }

  /** Hides the modal without saving the draft. */
  function close() {
    elements.settingsBackdrop.classList.add("hidden");
    elements.settingsBackdrop.setAttribute("aria-hidden", "true");
  }

  /** Returns whether the settings modal is visible. */
  function isOpen() {
    return !elements.settingsBackdrop.classList.contains("hidden");
  }

  /** Persists valid settings and immediately applies changes to the reader. */
  function save() {
    const draft = getDraftSettings();

    if (!draft.translationLanguages.length) {
      return;
    }

    state.settings = draft;
    saveSettings(state.settings);
    onThemeChanged(draft.theme);

    elements.ocrEngine.value = draft.ocrEngine;
    elements.voiceSelect.value = draft.voiceURI;

    applyTranslationLanguageVisibility();
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
