/** All date grouping uses the browser's local calendar, not UTC boundaries. */
export function localDayKey(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateTitle(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return "Undated";
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export function groupBySavedDay(cards) {
  const groups = new Map();
  for (const card of cards) {
    const key = localDayKey(card.savedAt) || "undated";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  }
  return groups;
}

export function sortSavedCards(cards, order = "newest") {
  const result = [...cards];
  result.sort((a, b) => {
    const timeA = Date.parse(a.savedAt || "") || 0;
    const timeB = Date.parse(b.savedAt || "") || 0;
    return order === "oldest" ? timeA - timeB : timeB - timeA;
  });
  return result;
}
