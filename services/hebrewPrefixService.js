import { stripHebrewMarks } from "../utils/hebrew.js";

const PREFIX_MEANINGS = Object.freeze({
  "ו": "and",
  "ה": "the",
  "ב": "in / at / with",
  "כ": "as / like",
  "ל": "to / for",
  "מ": "from",
});

function toPrefixPart(letter) {
  return {
    letter,
    meaning: PREFIX_MEANINGS[letter],
  };
}

function buildAnalysisFromSegments(word, segments, provider) {
  if (!Array.isArray(segments) || segments.length < 2) {
    return null;
  }

  const prefixes = [];
  let index = 0;

  while (
    index < segments.length - 1 &&
    segments[index].length === 1 &&
    PREFIX_MEANINGS[segments[index]]
  ) {
    prefixes.push(toPrefixPart(segments[index]));
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

async function analyzeWithRFTokenizer(word) {
  const response = await fetch("/api/morphology", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ word }),
  });

  if (!response.ok) {
    throw new Error("RFTokenizer morphology is unavailable.");
  }

  const payload = await response.json();

  return buildAnalysisFromSegments(
    payload.word || word,
    payload.segments,
    payload.provider || "rftokenizer",
  );
}

/**
 * Provides a minimal fallback when the local morphology backend is unavailable.
 *
 * The fallback removes at most one common attached prefix to avoid the
 * over-segmentation problem that the previous heuristic had.
 */
function analyzeConservatively(word) {
  const normalizedWord = stripHebrewMarks(word.trim());

  if (normalizedWord.length < 4) {
    return null;
  }

  const firstLetter = normalizedWord[0];

  if (!PREFIX_MEANINGS[firstLetter]) {
    return null;
  }

  return {
    originalWord: normalizedWord,
    prefixes: [toPrefixPart(firstLetter)],
    baseWord: normalizedWord.slice(1),
    provider: "fallback",
  };
}

/**
 * Uses the local RFTokenizer model for Hebrew morphological segmentation.
 * Falls back to a deliberately conservative single-prefix hint if the local
 * backend is unavailable.
 */
export async function analyzeHebrewPrefixes(word) {
  const cleanWord = stripHebrewMarks(word.trim());

  if (!cleanWord) {
    return null;
  }

  try {
    return await analyzeWithRFTokenizer(cleanWord);
  } catch (error) {
    console.info(
      "RFTokenizer morphology is unavailable; using conservative fallback.",
      error,
    );
    return analyzeConservatively(cleanWord);
  }
}
