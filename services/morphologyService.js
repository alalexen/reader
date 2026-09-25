import { MORPHOLOGY_LEXICON } from "../data/morphologyLexicon.js";
import { stripHebrewMarks } from "../utils/hebrew.js";

const EMPTY_ANALYSIS = {
  lemma: "",
  infinitive: "",
  root: "",
  partOfSpeech: "",
  binyan: "",
  tense: "",
  person: "",
  gender: "",
  number: "",
};

/**
 * Returns a conservative local morphology analysis.
 *
 * The current MVP intentionally avoids guessing roots or infinitives when a word
 * is not present in the local lexicon. Hebrew morphology has too many irregular
 * forms for a rule-only browser fallback to be reliable.
 */
export function analyzeHebrewWord(word) {
  const normalizedWord = stripHebrewMarks(word.trim());
  const entry = MORPHOLOGY_LEXICON[normalizedWord];

  if (entry) {
    return {
      ...EMPTY_ANALYSIS,
      ...entry,
      source: "lexicon",
      note:
        "This analysis comes from the local MVP lexicon. A full NLP provider can replace this service later without changing the UI.",
    };
  }

  return {
    ...EMPTY_ANALYSIS,
    source: "fallback",
    note:
      "No reliable local morphology entry is available for this word yet. The app does not guess the root or infinitive.",
  };
}
