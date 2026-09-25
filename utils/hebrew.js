/**
 * Returns true when the token contains at least one Hebrew character.
 */
export function containsHebrew(token) {
  return /[\u0590-\u05FF]/u.test(token);
}

/**
 * Removes surrounding punctuation while preserving Hebrew letters and marks.
 */
export function normalizeHebrewWord(token) {
  return token.replace(/^[^\u0590-\u05FF]+|[^\u0590-\u05FF]+$/gu, "");
}

/**
 * Removes Hebrew vowel and cantillation marks for dictionary lookups.
 */
export function stripHebrewMarks(text) {
  return text.normalize("NFD").replace(/[\u0591-\u05C7]/gu, "").normalize("NFC");
}

/**
 * Splits text into sentence-like chunks while preserving punctuation.
 */
export function splitIntoSentences(text) {
  return text.match(/[^.!?…\n]+[.!?…]?|\n+/gu) || [text];
}
