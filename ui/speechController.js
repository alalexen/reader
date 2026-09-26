import {
  getGoogleTtsVoices,
  getHebrewVoices,
  getPreferredHebrewVoice,
  onVoicesChanged,
  speakHebrew,
  stopSpeech,
} from "../services/speechService.js";

export function createSpeechController({ elements, state }) {
  function appendSelectOption(select, value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }

  async function initializeVoiceSelector() {
    const browserVoices = getHebrewVoices();
    const googleVoices = await getGoogleTtsVoices();
    const preferredVoice = getPreferredHebrewVoice();
    const defaultSystemVoice =
      browserVoices.find((voice) => voice.default) || preferredVoice || null;
    const previousSelection =
      state.settings.voiceURI || defaultSystemVoice?.voiceURI || "";

    elements.voiceSelect.replaceChildren();

    if (defaultSystemVoice) {
      appendSelectOption(
        elements.voiceSelect,
        defaultSystemVoice.voiceURI,
        `${defaultSystemVoice.name} · system (default)`,
      );
    }

    browserVoices
      .filter((voice) => voice.voiceURI !== defaultSystemVoice?.voiceURI)
      .forEach((voice) => {
        appendSelectOption(
          elements.voiceSelect,
          voice.voiceURI,
          `${voice.name} · system`,
        );
      });

    googleVoices.forEach((voice) => {
      appendSelectOption(
        elements.voiceSelect,
        voice.voiceURI,
        `${voice.name} · ${voice.gender}`,
      );
    });

    if (!browserVoices.length && !googleVoices.length) {
      appendSelectOption(
        elements.voiceSelect,
        "",
        "System Hebrew voice (default)",
      );
    }

    const availableValues = [...elements.voiceSelect.options].map(
      (option) => option.value,
    );

    elements.voiceSelect.value = availableValues.includes(previousSelection)
      ? previousSelection
      : defaultSystemVoice?.voiceURI || availableValues[0] || "";
  }

  async function speak(text) {
    return speakHebrew(
      text,
      Number(elements.speechRate.value),
      elements.voiceSelect.value,
    );
  }

  function watchVoiceChanges() {
    onVoicesChanged(initializeVoiceSelector);
  }

  return {
    initializeVoiceSelector,
    speak,
    stop: stopSpeech,
    watchVoiceChanges,
  };
}
