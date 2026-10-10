import { saveFlashcard } from "../services/flashcardsService.js";

/** Keeps the reader's Remember word action independent of the vocabulary pages. */
export function createWordSaveController({ elements, state, reader, onChanged }) {
  async function rememberActiveWord() {
    const data = state.activeWordData;
    if (!data?.word) return;
    if (!state.vocabularyReady) {
      elements.translationStatus.textContent =
        "Saved Words is unavailable. Check the database connection and reload.";
      return;
    }

    const selectedWord = data.word;
    const selectionId = state.wordSelectionId;
    elements.rememberWordButton.disabled = true;
    elements.rememberWordButton.textContent = "Saving…";
    try {
      if (!data.translations) {
        const translations = await reader.translate(selectedWord, "word", selectionId);
        if (!translations) throw new Error("Translations could not be loaded.");
        data.translations = translations;
      }
      if (selectionId !== state.wordSelectionId) return;
      state.flashcards = await saveFlashcard({
        word: selectedWord,
        translations: data.translations,
        sentence: data.sentence || "",
      });
      onChanged();
      elements.translationStatus.textContent = `Saved "${selectedWord}" to Saved Words.`;
    } catch (error) {
      console.error("Could not save word:", error);
      elements.translationStatus.textContent = "Could not save this word. Try again.";
    } finally {
      elements.rememberWordButton.textContent = "Remember word";
      reader.updateRememberButton();
    }
  }

  return { rememberActiveWord };
}
