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

/**
 * Scores a Hebrew voice so the app can prefer a natural male voice when one is
 * exposed by the current browser or operating system.
 */
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
 * Finds the best available Hebrew voice.
 *
 * Web Speech API does not expose a standardized gender property, so this uses
 * known voice names and descriptive hints when available.
 */
function findPreferredHebrewVoice() {
  const voices = window.speechSynthesis.getVoices();

  return (
    voices
      .map((voice) => ({
        voice,
        score: scoreHebrewVoice(voice),
      }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => b.score - a.score)[0]?.voice || null
  );
}

/**
 * Speaks Hebrew text with the browser Web Speech API.
 *
 * A rate of 1 is passed directly to SpeechSynthesisUtterance as the native
 * normal speed. Pitch stays at 1 to preserve the original voice character.
 */
export function speakHebrew(text, rate = 1) {
  const cleanText = text.trim();

  if (!cleanText) {
    return;
  }

  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const hebrewVoice = findPreferredHebrewVoice();

  utterance.lang = "he-IL";
  utterance.rate = Number(rate);
  utterance.pitch = 1;
  utterance.volume = 1;

  if (hebrewVoice) {
    utterance.voice = hebrewVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeech() {
  window.speechSynthesis.cancel();
}
