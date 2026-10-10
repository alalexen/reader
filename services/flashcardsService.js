const STORAGE_KEY = "hebrewReaderFlashcards";
const MIGRATED_KEY = "hebrewReaderFlashcardsImportedToPostgresV1";

/** Preserve the original browser cards as a backup after migration. */
/** Reads old localStorage cards without deleting the migration backup. */
export function loadLegacyFlashcards() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const cards = JSON.parse(raw);
  if (!Array.isArray(cards)) throw new Error("Invalid legacy flashcards format.");
  return cards.map(({ example, ...card }) => card);
}

/** Performs a JSON flashcard API request and surfaces HTTP errors. */
async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    let detail = "";
    try { detail = (await response.json()).error || ""; } catch {}
    throw new Error(detail || `Flashcards API failed (HTTP ${response.status}).`);
  }
  return response.json();
}

/** Retry unfinished imports, but never re-import after a confirmed migration. */
/** Imports legacy words once before reading database-backed cards. */
export async function initializeFlashcards() {
  if (localStorage.getItem(MIGRATED_KEY) !== "true") {
    const legacy = loadLegacyFlashcards();
    // One server transaction; the acknowledgement is written only after success.
    await request("/api/flashcards/import", {
      method: "POST",
      body: JSON.stringify({ cards: legacy }),
    });
    localStorage.setItem(MIGRATED_KEY, "true");
  }
  return request("/api/flashcards");
}

/** Stores or updates one card through the PostgreSQL API. */
export async function saveFlashcard(card) {
  return request("/api/flashcards", {
    method: "POST",
    body: JSON.stringify(card),
  });
}

/** Deletes a card then fetches the updated collection. */
export async function removeFlashcard(id) {
  await request(`/api/flashcards/${encodeURIComponent(id)}`, { method: "DELETE" });
  return request("/api/flashcards");
}

