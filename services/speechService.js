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

const GOOGLE_HEBREW_VOICES = [
  {
    voiceURI: "google:he-IL-Wavenet-A",
    name: "Google WaveNet A",
    lang: "he-IL",
    gender: "Female",
    cloud: true,
  },
  {
    voiceURI: "google:he-IL-Wavenet-C",
    name: "Google WaveNet C",
    lang: "he-IL",
    gender: "Female",
    cloud: true,
  },
  {
    voiceURI: "google:he-IL-Wavenet-B",
    name: "Google WaveNet B",
    lang: "he-IL",
    gender: "Male",
    cloud: true,
  },
  {
    voiceURI: "google:he-IL-Wavenet-D",
    name: "Google WaveNet D",
    lang: "he-IL",
    gender: "Male",
    cloud: true,
  },
];

let activeAudio = null;
let activeAudioUrl = "";
let activeRequestController = null;
let speechSessionId = 0;

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
 * Returns Hebrew voices exposed by the browser.
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
 * Returns the best local Hebrew voice currently exposed by the browser.
 */
export function getPreferredHebrewVoice() {
  return getHebrewVoices()[0] || null;
}

/**
 * Checks whether the local server has Google Cloud TTS credentials.
 */
export async function getGoogleTtsVoices() {
  try {
    const response = await fetch("/api/tts/status", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const status = await response.json();

    return status.available ? GOOGLE_HEBREW_VOICES : [];
  } catch (error) {
    console.info("Google TTS is not configured; using browser voices.", error);
    return [];
  }
}

/**
 * Subscribes to browser voice-list changes.
 */
export function onVoicesChanged(callback) {
  window.speechSynthesis.addEventListener?.("voiceschanged", callback);
}

function speakWithBrowser(text, rate = 1, voiceURI = "") {
  const utterance = new SpeechSynthesisUtterance(text);
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

function splitForGoogleTts(text, maxLength = 3200) {
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const parts = normalized.split(/(?<=[.!?׃])\s+|\n+/u);
  const chunks = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }
  };

  parts.forEach((part) => {
    const cleanPart = part.trim();

    if (!cleanPart) {
      return;
    }

    if (cleanPart.length > maxLength) {
      pushCurrent();

      for (let index = 0; index < cleanPart.length; index += maxLength) {
        chunks.push(cleanPart.slice(index, index + maxLength));
      }
      return;
    }

    const candidate = current ? `${current} ${cleanPart}` : cleanPart;

    if (candidate.length > maxLength) {
      pushCurrent();
      current = cleanPart;
    } else {
      current = candidate;
    }
  });

  pushCurrent();
  return chunks;
}

function waitForAudio(audio, sessionId) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };

    const handleEnded = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error("Could not play synthesized speech."));
    };

    if (sessionId !== speechSessionId) {
      resolve();
      return;
    }

    audio.addEventListener("ended", handleEnded, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    audio.play().catch((error) => {
      cleanup();
      reject(error);
    });
  });
}

async function speakWithGoogle(text, rate, voiceURI, sessionId) {
  const voiceName = voiceURI.replace(/^google:/, "");
  const chunks = splitForGoogleTts(text);

  for (const chunk of chunks) {
    if (sessionId !== speechSessionId) {
      return;
    }

    activeRequestController = new AbortController();

    const response = await fetch("/api/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: chunk,
        voice: voiceName,
        rate: Number(rate),
      }),
      signal: activeRequestController.signal,
    });

    if (!response.ok) {
      let detail = "Google Text-to-Speech request failed.";

      try {
        const body = await response.json();
        detail = body.error || detail;
      } catch {
        // Keep the generic message when the response is not JSON.
      }

      throw new Error(detail);
    }

    const audioBlob = await response.blob();

    if (sessionId !== speechSessionId) {
      return;
    }

    activeAudioUrl = URL.createObjectURL(audioBlob);
    activeAudio = new Audio(activeAudioUrl);

    await waitForAudio(activeAudio, sessionId);

    activeAudio.pause();
    activeAudio = null;
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = "";
  }
}

/**
 * Speaks Hebrew using Google WaveNet when a Google voice is selected.
 * If Google is unavailable, it falls back to the browser Hebrew voice.
 */
export async function speakHebrew(text, rate = 1, voiceURI = "") {
  const cleanText = text.trim();

  if (!cleanText) {
    return { provider: "none" };
  }

  stopSpeech();
  const sessionId = speechSessionId;

  if (voiceURI.startsWith("google:")) {
    try {
      await speakWithGoogle(cleanText, rate, voiceURI, sessionId);
      return { provider: "google" };
    } catch (error) {
      if (error?.name === "AbortError" || sessionId !== speechSessionId) {
        return { provider: "stopped" };
      }

      console.warn("Google TTS failed; falling back to browser speech.", error);
      speakWithBrowser(cleanText, rate);
      return {
        provider: "browser-fallback",
        error: error.message,
      };
    }
  }

  speakWithBrowser(cleanText, rate, voiceURI);
  return { provider: "browser" };
}

export function stopSpeech() {
  speechSessionId += 1;

  activeRequestController?.abort();
  activeRequestController = null;

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = "";
  }

  window.speechSynthesis.cancel();
}
