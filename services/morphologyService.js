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
 * Adds conservative grammatical information for common Hebrew verb endings.
 *
 * This fallback intentionally does not invent roots, lemmas, or infinitives.
 * Those fields require a real Hebrew morphological analyzer.
 */
function analyzeCommonVerbEnding(word) {
  if (word.length < 3) {
    return null;
  }

  const suffixRules = [
    {
      suffix: "תי",
      analysis: {
        partOfSpeech: "Likely verb",
        tense: "Past",
        person: "1st",
        gender: "Common",
        number: "Singular",
      },
    },
    {
      suffix: "נו",
      analysis: {
        partOfSpeech: "Likely verb",
        tense: "Past",
        person: "1st",
        gender: "Common",
        number: "Plural",
      },
    },
    {
      suffix: "תם",
      analysis: {
        partOfSpeech: "Likely verb",
        tense: "Past",
        person: "2nd",
        gender: "Masculine",
        number: "Plural",
      },
    },
    {
      suffix: "תן",
      analysis: {
        partOfSpeech: "Likely verb",
        tense: "Past",
        person: "2nd",
        gender: "Feminine",
        number: "Plural",
      },
    },
  ];

  const rule = suffixRules.find(({ suffix }) => word.endsWith(suffix));

  if (!rule) {
    return null;
  }

  return {
    ...EMPTY_ANALYSIS,
    ...rule.analysis,
    source: "heuristic",
    note:
      "The grammatical ending was recognized locally. Root, dictionary form, infinitive, and binyan are intentionally left blank because guessing them would be unreliable.",
  };
}

/**
 * Returns a local Hebrew morphology analysis.
 *
 * Exact lexicon entries are preferred. For unknown words, a small conservative
 * fallback recognizes only grammatical endings that are reasonably distinctive.
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
        "This form is available in the local morphology lexicon.",
    };
  }

  const fallback = analyzeCommonVerbEnding(normalizedWord);

  if (fallback) {
    return fallback;
  }

  return {
    ...EMPTY_ANALYSIS,
    source: "unknown",
    note:
      "No reliable local morphology analysis is available for this form yet. The app avoids guessing a root or dictionary form.",
  };
}
