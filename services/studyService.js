/** Backend scheduling is authoritative: rating is persisted before advancing. */
/** Persists a valid spaced-repetition grade before advancing a study session. */
export async function gradeWord(cardId, rating) {
  if (!Number.isInteger(cardId) || cardId < 1) throw new Error("Invalid card.");
  if (!["again", "hard", "good", "easy"].includes(rating)) {
    throw new Error("Unsupported rating.");
  }
  const response = await fetch(`/api/review/${cardId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating }),
  });
  if (!response.ok) throw new Error("Could not save review (" + response.status + ").");
  return response.json();
}
