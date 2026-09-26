import { stripHebrewMarks } from "../utils/hebrew.js";

const PREFIXES = Object.freeze({
  "ו": "and",
  "ה": "the",
  "ב": "in / at / with",
  "כ": "as / like",
  "ל": "to / for",
  "מ": "from",
});

const ALLOWED_SECOND_PREFIXES = new Set(["ה", "ב", "כ", "ל", "מ"]);
const MIN_BASE_LENGTH = 3;

function createPrefix(letter) {
  return {
    letter,
    meaning: PREFIXES[letter],
  };
}

/**
 * Returns a conservative, orthography-based prefix hint.
 *
 * Hebrew morphology is context-sensitive, so this function intentionally
 * reports a possible decomposition rather than claiming a dictionary analysis.
 */
export function analyzeHebrewPrefixes(word) {
  const normalizedWord = stripHebrewMarks(word.trim());

  if (normalizedWord.length < MIN_BASE_LENGTH + 1) {
    return null;
  }

  const first = normalizedWord[0];

  if (!PREFIXES[first]) {
    return null;
  }

  const prefixes = [createPrefix(first)];
  let baseWord = normalizedWord.slice(1);

  if (
    baseWord.length > MIN_BASE_LENGTH &&
    ALLOWED_SECOND_PREFIXES.has(baseWord[0])
  ) {
    prefixes.push(createPrefix(baseWord[0]));
    baseWord = baseWord.slice(1);
  }

  if (baseWord.length < MIN_BASE_LENGTH) {
    return null;
  }

  return {
    originalWord: normalizedWord,
    prefixes,
    baseWord,
  };
}
