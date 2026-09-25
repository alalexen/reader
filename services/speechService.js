const MALE_VOICE_HINTS = [
  "avri",
  "male",
  "man",
  "masculine",
];

const FEMALE_VOICE_HINTS = [
  "hila",
  "female",
  "woman",
  "feminine",
];

function scoreHebrewVoice(voice) {
  const language = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();

  let score = 0;

  if (language === "he-il") {
    score += 100;
  } else if (language.startsWith("he")) {
    score += 70;
  } else {
    return -Infinity;
  }

  if (voice.localService) {
    score += 10;
  }

  if (voice.default) {
    score += 5;
  }

  if (MALE_VOICE_HINTS.some((hint) => name.includes(hint))) {
    score += 80;
  }

  if (FEMALE_VOICE_HINTS.some((hint) => name.includes(hint))) {
    score -= 80;
  }

  return score;
}

/**
 * Returns available Hebrew voices with the preferred voice first.
 */
export function getHebrewVoices() {
  return window.speechSynthesis
    .getVoices()
    .map((voice) => ({
      voice,
      score: scoreHebrewVoice(voice),
    }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((a, b) => b.score - a.score)
    .map(({ voice }) => voice);
}

/**
 * Returns the best Hebrew voice currently exposed by the browser.
 */
export function getPreferredHebrewVoice() {
  return getHebrewVoices()[0] || null;
}

/**
 * Subscribes to browser voice-list changes.
 */
export function onVoicesChanged(callback) {
  window.speechSynthesis.addEventListener?.("voiceschanged", callback);
}

/**
 * Speaks Hebrew text with the browser Web Speech API.
 *
 * A rate of 1 is passed directly to SpeechSynthesisUtterance as the native
 * normal speed. Pitch stays at 1 to preserve the original voice character.
 */
export function speakHebrew(text, rate = 1, voiceURI = "") {
  const cleanText = text.trim();

  if (!cleanText) {
    return;
  }

  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const voices = getHebrewVoices();
  const selectedVoice =
    voices.find((voice) => voice.voiceURI === voiceURI) ||
    getPreferredHebrewVoice();

  utterance.lang = "he-IL";
  utterance.rate = Number(rate);
  utterance.pitch = 1;
  utterance.volume = 1;

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeech() {
  window.speechSynthesis.cancel();
}
