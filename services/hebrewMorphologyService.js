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
  if (!Array.isArray(segments) || segments.length < 2) {
    return null;
  }

  const prefixes = [];
  let index = 0;

  while (index < segments.length - 1) {
    const segmentPrefixes = splitPrefixSegment(segments[index]);

    if (!segmentPrefixes.length) {
      break;
    }

    prefixes.push(...segmentPrefixes);
    index += 1;
  }

  if (!prefixes.length) {
    return null;
  }

  const baseWord = segments.slice(index).join("");

  if (!baseWord) {
    return null;
  }

  return {
    originalWord: word,
    prefixes,
    baseWord,
    provider,
  };
}

/**
 * Requests sentence-aware Hebrew morphological segmentation from the local
 * HebPipe backend. No spelling-based fallback is used: an unavailable or
 * inconclusive analyzer simply produces no structure hint.
 */
export async function analyzeHebrewMorphology(word, sentence) {
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
      body: JSON.stringify({
        word: cleanWord,
        sentence: sentence?.trim() || cleanWord,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();

    return buildWordStructure(
      payload.word || cleanWord,
      payload.segments,
      payload.provider || "hebpipe",
    );
  } catch (error) {
    console.info("HebPipe morphology is unavailable.", error);
    return null;
  }
}
