import {
  buildQuizletImportText,
  removeFlashcard,
  saveFlashcard,
} from "../services/flashcardsService.js";

const LANGUAGE_LABELS = Object.freeze({
  en: "EN",
  ru: "RU",
  uk: "UK",
});

export function createFlashcardsController({
  elements,
  state,
  reader,
  speak,
}) {
  function createFlashcardElement(card) {
    const article = document.createElement("article");
    article.className = "saved-flashcard";

    const header = document.createElement("div");
    header.className = "saved-flashcard-header";

    const word = document.createElement("strong");
    word.className = "saved-flashcard-word";
    word.dir = "rtl";
    word.lang = "he";
    word.textContent = card.word;

    const actions = document.createElement("div");
    actions.className = "inline-actions";

    const speakWordButton = document.createElement("button");
    speakWordButton.type = "button";
    speakWordButton.className = "secondary";
    speakWordButton.textContent = "Speak word";
    speakWordButton.addEventListener("click", () => speak(card.word));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary danger-button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      state.flashcards = removeFlashcard(card.id);
      renderFlashcards();
    });

    actions.append(speakWordButton, deleteButton);
    header.append(word, actions);

    const translations = document.createElement("div");
    translations.className = "saved-translations";

    state.settings.translationLanguages.forEach((code) => {
      const item = document.createElement("span");
      const label = document.createElement("b");
      label.textContent = LANGUAGE_LABELS[code] || code.toUpperCase();
      item.append(
        label,
        document.createTextNode(` ${card.translations?.[code] || "—"}`),
      );
      translations.append(item);
    });

    const sourceSentence = document.createElement("div");
    sourceSentence.className = "saved-example";

    const sentenceLabel = document.createElement("span");
    sentenceLabel.className = "saved-label";
    sentenceLabel.textContent = "From your text";

    const sentenceText = document.createElement("p");
    sentenceText.dir = "rtl";
    sentenceText.lang = "he";
    sentenceText.textContent = card.sentence || "—";

    const speakSentenceButton = document.createElement("button");
    speakSentenceButton.type = "button";
    speakSentenceButton.className = "secondary compact-button";
    speakSentenceButton.textContent = "Speak sentence";
    speakSentenceButton.addEventListener("click", () => speak(card.sentence));

    sourceSentence.append(sentenceLabel, sentenceText, speakSentenceButton);
    article.append(header, translations, sourceSentence);

    return article;
  }

  function renderFlashcards() {
    elements.flashcardsList.replaceChildren();

    if (!state.flashcards.length) {
      const emptyState = document.createElement("p");
      emptyState.className = "empty-state";
      emptyState.textContent = "No saved words yet.";
      elements.flashcardsList.append(emptyState);
      elements.copyQuizletButton.disabled = true;
      return;
    }

    state.flashcards.forEach((card) => {
      elements.flashcardsList.append(createFlashcardElement(card));
    });

    elements.copyQuizletButton.disabled = false;
  }

  async function rememberActiveWord() {
    const data = state.activeWordData;

    if (!data?.word) {
      return;
    }

    elements.rememberWordButton.disabled = true;
    elements.rememberWordButton.textContent = "Saving...";

    try {
      if (!data.translations) {
        const translations = await reader.translate(
          data.word,
          "word",
          state.wordSelectionId,
        );

        if (translations) {
          data.translations = translations;
        }
      }

      state.flashcards = saveFlashcard({
        word: data.word,
        translations: data.translations || {
          uk: "—",
          en: "—",
          ru: "—",
        },
        sentence: data.sentence,
      });

      renderFlashcards();
      elements.translationStatus.textContent = "";
      elements.flashcardsStatus.textContent = `Saved ${data.word}.`;
    } catch (error) {
      console.error("Could not save flashcard:", error);
      elements.flashcardsStatus.textContent =
        "Could not save this word in the browser.";
    } finally {
      elements.rememberWordButton.textContent = "Remember word";
      reader.updateRememberButton();
    }
  }

  async function copyQuizletImport() {
    const text = buildQuizletImportText(state.flashcards);

    if (!text) {
      elements.flashcardsStatus.textContent = "Save at least one word first.";
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      elements.flashcardsStatus.textContent =
        "Quizlet import text copied. Open Quizlet, create a set, choose Import, and paste it.";
    } catch (error) {
      console.error("Could not copy Quizlet import text:", error);
      elements.flashcardsStatus.textContent =
        "Could not copy automatically. Try again from a secure localhost tab.";
    }
  }

  return {
    copyQuizletImport,
    rememberActiveWord,
    renderFlashcards,
  };
}
