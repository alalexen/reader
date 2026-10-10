/** Persistent review queue and grading operations. */
async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    throw new Error(`Review request failed (HTTP ${response.status})`);
  }
  return response.json();
}

export function fetchDueCards() {
  return request("/api/review/due");
}

export function gradeReview(cardId, rating) {
  if (!["again", "hard", "good", "easy"].includes(rating)) {
    throw new Error("Unsupported review rating.");
  }
  return request(`/api/review/${encodeURIComponent(cardId)}`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}
