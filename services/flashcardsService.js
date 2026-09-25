const STORAGE_KEY = "hebrewReaderFlashcards";

/**
 * Loads saved flashcards from localStorage.
 */
export function loadFlashcards() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const cards = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(cards)) {
      return [];
    }

    return cards.map(({ example, ...card }) => card);
  } catch (error) {
    console.error("Failed to read saved flashcards:", error);
    return [];
  }
}

/**
 * Saves one flashcard. Existing cards with the same Hebrew word are updated
 * instead of duplicated.
 */
export function saveFlashcard(card) {
  const cards = loadFlashcards();
  const existingIndex = cards.findIndex((item) => item.word === card.word);

  const { example, ...cardWithoutExample } = card;
  const normalizedCard = {
    ...cardWithoutExample,
    id: card.id || crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    cards[existingIndex] = {
      ...cards[existingIndex],
      ...normalizedCard,
      id: cards[existingIndex].id,
    };
  } else {
    cards.unshift(normalizedCard);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  return cards;
}

/**
 * Removes one flashcard by id.
 */
export function removeFlashcard(cardId) {
  const cards = loadFlashcards().filter((card) => card.id !== cardId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  return cards;
}

/**
 * Builds a tab-separated list that can be pasted into Quizlet's Import tool.
 *
 * Quizlet treats each line as one card and the tab as the separator between
 * the term and definition.
 */
export function buildQuizletImportText(cards) {
  return cards
    .map((card) => {
      const definitionParts = [
        `English: ${card.translations?.en || "—"}`,
        `Russian: ${card.translations?.ru || "—"}`,
        `Ukrainian: ${card.translations?.uk || "—"}`,
        card.sentence ? `From text: ${card.sentence}` : "",
      ].filter(Boolean);

      return `${card.word}\t${definitionParts.join(" | ")}`;
    })
    .join("\n");
}
