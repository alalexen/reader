/**
 * Finds a Hebrew voice exposed by the current browser or operating system.
 */
function findHebrewVoice() {
  const voices = window.speechSynthesis.getVoices();

  return (
    voices.find((voice) => voice.lang.toLowerCase() === "he-il") ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("he")) ||
    null
  );
}

/**
 * Speaks Hebrew text with the browser Web Speech API.
 */
export function speakHebrew(text, rate = 1) {
  const cleanText = text.trim();

  if (!cleanText) {
    return;
  }

  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const hebrewVoice = findHebrewVoice();

  utterance.lang = "he-IL";
  utterance.rate = rate;

  if (hebrewVoice) {
    utterance.voice = hebrewVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeech() {
  window.speechSynthesis.cancel();
}
