import { analyzeHebrewMorphology } from "../services/hebrewMorphologyService.js";
import { translateIntoLanguages } from "../services/translationService.js";
import {
  containsHebrew,
  normalizeHebrewWord,
  splitIntoSentences,
} from "../utils/hebrew.js";

export function createReaderController({
  elements,
  translationElements,
  state,
}) {
  function setTranslationPlaceholders(scope) {
    Object.values(translationElements[scope]).forEach((element) => {
      element.textContent = "—";
    });
  }

  function updateRememberButton() {
    const hasSelectedWord = Boolean(state.activeWordData?.word);

    elements.rememberWordButton.disabled = !hasSelectedWord;
    elements.rememberWordButton.title = hasSelectedWord
      ? "Save this word to My flashcards"
      : "Select a Hebrew word first";
  }

  function closeWordPanel() {
    state.wordSelectionId += 1;
    state.activeSentence = "";
    state.activeWordData = null;
    elements.wordStructureParts.replaceChildren();
    elements.wordStructureSection.classList.add("hidden");
    elements.wordPanel.classList.add("hidden");
    elements.translationStatus.textContent = "";
    updateRememberButton();
  }

  function updateTextWorkspaceControls() {
    const hasText = elements.editableText.value.trim().length > 0;

    elements.speakButton.disabled = !hasText;
    elements.stopButton.disabled = !hasText;
    elements.renderButton.classList.toggle("hidden", !hasText);

    if (!hasText && state.readerMode !== "edit") {
      setReaderMode("edit");
    }
  }

  function setReaderMode(mode) {
    const hasText = elements.editableText.value.trim().length > 0;
    const nextMode = mode === "reader" && hasText ? "reader" : "edit";

    state.readerMode = nextMode;
    const isReaderMode = nextMode === "reader";

    elements.editableText.classList.toggle("hidden", isReaderMode);
    elements.reader.classList.toggle("hidden", !isReaderMode);
    elements.renderButton.textContent = isReaderMode
      ? "Edit text"
      : "Make words clickable";

    if (isReaderMode) {
      renderClickableText();
    } else {
      closeWordPanel();
    }
  }

  function toggleTextWorkspaceSize() {
    state.isTextWorkspaceExpanded = !state.isTextWorkspaceExpanded;
    elements.textWorkspace.classList.toggle(
      "is-expanded",
      state.isTextWorkspaceExpanded,
    );
    elements.resizeTextButton.textContent = state.isTextWorkspaceExpanded
      ? "Collapse"
      : "Expand";
  }

  async function renderWordStructure(word, selectionId) {
    elements.wordStructureParts.replaceChildren();
    elements.wordStructureSection.classList.add("hidden");

    const analysis = await analyzeHebrewMorphology(word);

    if (selectionId !== state.wordSelectionId || !analysis) {
      return;
    }

    const appendPart = (tokenText, meaningText, className = "") => {
      const part = document.createElement("span");
      part.className = `word-structure-part ${className}`.trim();

      const token = document.createElement("strong");
      token.className = "word-structure-token";
      token.dir = "rtl";
      token.lang = "he";
      token.textContent = tokenText;

      const meaning = document.createElement("span");
      meaning.className = "word-structure-meaning";
      meaning.textContent = meaningText;

      part.append(token, meaning);
      elements.wordStructureParts.append(part);
    };

    if (analysis.error) {
      appendPart("HebPipe", analysis.error, "base-part");
      elements.wordStructureSection.classList.remove("hidden");
      return;
    }

    if (!analysis.segmented) {
      appendPart(analysis.originalWord, "No segmentation returned", "base-part");
      elements.wordStructureSection.classList.remove("hidden");
      return;
    }

    if (analysis.prefixes.length) {
      analysis.prefixes.forEach((prefix) => {
        appendPart(`${prefix.letter}־`, prefix.meaning, "prefix-part");
      });
      appendPart(analysis.baseWord, "base word", "base-part");
    } else {
      analysis.segments.forEach((segment, index) => {
        appendPart(
          segment,
          index === analysis.segments.length - 1 ? "segment" : "morpheme",
          index === analysis.segments.length - 1 ? "base-part" : "prefix-part",
        );
      });
    }

    elements.wordStructureSection.classList.remove("hidden");
  }

  async function translate(text, scope, selectionId = null) {
    if (!text.trim()) {
      return null;
    }

    const isWordTranslation = scope === "word";
    elements.translationStatus.textContent = "";
    elements.translateWordButton.disabled = true;
    elements.translateSentenceButton.disabled = true;

    try {
      const translations = await translateIntoLanguages(
        text,
        state.settings.translationLanguages,
        state.settings.translationProvider,
      );

      if (
        isWordTranslation &&
        selectionId !== null &&
        selectionId !== state.wordSelectionId
      ) {
        return null;
      }

      Object.entries(translations).forEach(([languageCode, translatedText]) => {
        translationElements[scope][languageCode].textContent = translatedText;
      });

      if (isWordTranslation && state.activeWordData?.word === text.trim()) {
        state.activeWordData.translations = translations;
        updateRememberButton();
      }

      return translations;
    } catch (error) {
      console.error("Translation failed:", error);

      if (
        isWordTranslation &&
        selectionId !== null &&
        selectionId !== state.wordSelectionId
      ) {
        return null;
      }

      elements.translationStatus.textContent =
        "Translation failed. Please try again in a moment.";
      return null;
    } finally {
      elements.translateWordButton.disabled = false;
      elements.translateSentenceButton.disabled = false;
    }
  }

  async function activateWord(token, sentence) {
    const word = normalizeHebrewWord(token);

    if (!word) {
      return;
    }

    const selectionId = ++state.wordSelectionId;

    elements.selectedWord.textContent = word;
    state.activeSentence = sentence.trim();
    state.activeWordData = {
      word,
      sentence: state.activeSentence,
      translations: null,
    };

    elements.selectedSentence.textContent = state.activeSentence;
    elements.reversoLink.href =
      `https://context.reverso.net/translation/hebrew-english/${encodeURIComponent(word)}`;
    updateRememberButton();

    setTranslationPlaceholders("word");
    setTranslationPlaceholders("sentence");
    elements.translationStatus.textContent = "";
    elements.wordPanel.classList.remove("hidden");

    await Promise.all([
      renderWordStructure(word, selectionId),
      translate(word, "word", selectionId),
    ]);
    updateRememberButton();
  }

  function appendSentence(sentence) {
    const tokens = sentence.split(/(\s+)/u);

    tokens.forEach((token) => {
      if (/^\s+$/u.test(token) || !containsHebrew(token)) {
        elements.reader.append(document.createTextNode(token));
        return;
      }

      const wordElement = document.createElement("span");
      wordElement.className = "word-token";
      wordElement.tabIndex = 0;
      wordElement.setAttribute("role", "button");
      wordElement.textContent = token;

      const activate = () => activateWord(token, sentence);

      wordElement.addEventListener("click", activate);
      wordElement.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });

      elements.reader.append(wordElement);
    });
  }

  function renderClickableText() {
    const text = elements.editableText.value.trim();
    elements.reader.replaceChildren();

    if (!text) {
      closeWordPanel();
      updateTextWorkspaceControls();
      return;
    }

    splitIntoSentences(text).forEach(appendSentence);
    updateTextWorkspaceControls();
  }

  function clear() {
    state.activeSentence = "";
    state.activeWordData = null;
    state.wordSelectionId += 1;
    elements.editableText.value = "";
    setReaderMode("edit");
    state.isTextWorkspaceExpanded = false;
    elements.textWorkspace.classList.remove("is-expanded");
    elements.resizeTextButton.textContent = "Expand";
    setTranslationPlaceholders("word");
    setTranslationPlaceholders("sentence");
    closeWordPanel();
    renderClickableText();
  }

  return {
    clear,
    closeWordPanel,
    setReaderMode,
    toggleTextWorkspaceSize,
    translate,
    updateRememberButton,
    updateTextWorkspaceControls,
  };
}
