import { stripHebrewMarks } from "../utils/hebrew.js";

const PREFIX_MEANINGS = Object.freeze({
  "ו": "and",
  "ה": "the",
  "ב": "in / at / with",
  "כ": "as / like",
  "ל": "to / for",
  "מ": "from",
  "ש": "that / which",
});

function splitPrefixSegment(segment) {
  if (!segment) {
    return [];
  }

  const letters = [...segment];

  if (!letters.every((letter) => PREFIX_MEANINGS[letter])) {
    return [];
  }

  return letters.map((letter) => ({
    letter,
    meaning: PREFIX_MEANINGS[letter],
  }));
}

function buildWordStructure(word, segments, provider) {
  const normalizedSegments = Array.isArray(segments)
    ? segments.filter(Boolean)
    : [];

  if (normalizedSegments.length < 2) {
    return {
      originalWord: word,
      provider,
      segmented: false,
      segments: normalizedSegments.length ? normalizedSegments : [word],
      prefixes: [],
      baseWord: word,
    };
  }

  const prefixes = [];
  let index = 0;

  while (index < normalizedSegments.length - 1) {
    const segmentPrefixes = splitPrefixSegment(normalizedSegments[index]);

    if (!segmentPrefixes.length) {
      break;
    }

    prefixes.push(...segmentPrefixes);
    index += 1;
  }

  const baseWord = prefixes.length
    ? normalizedSegments.slice(index).join("")
    : "";

  return {
    originalWord: word,
    provider,
    segmented: true,
    segments: normalizedSegments,
    prefixes,
    baseWord,
  };
}

/**
 * Requests Hebrew morphological segmentation from the local HebPipe backend.
 * Raw segments are preserved even when they cannot be classified as known
 * prefixes, so the UI can show the analyzer result instead of hiding it.
 */
export async function analyzeHebrewMorphology(word) {
  const cleanWord = stripHebrewMarks(word.trim());

  if (!cleanWord) {
    return null;
  }

  try {
    const response = await fetch("/api/morphology", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ word: cleanWord }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        originalWord: cleanWord,
        provider: "hebpipe",
        error: payload.error || "HebPipe morphology is unavailable.",
        code: payload.code || "request_failed",
        segments: [],
        prefixes: [],
        segmented: false,
        baseWord: cleanWord,
      };
    }

    return buildWordStructure(
      payload.word || cleanWord,
      payload.segments,
      payload.provider || "hebpipe",
    );
  } catch (error) {
    console.info("HebPipe morphology is unavailable.", error);
    return {
      originalWord: cleanWord,
      provider: "hebpipe",
      error: "HebPipe morphology is unavailable.",
      code: "network_error",
      segments: [],
      prefixes: [],
      segmented: false,
      baseWord: cleanWord,
    };
  }
}
