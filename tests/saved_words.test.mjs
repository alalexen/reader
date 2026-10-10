import test from "node:test";
import assert from "node:assert/strict";
import { dateTitle, groupBySavedDay, localDayKey, sortSavedCards } from "../utils/savedWords.js";

test("local calendar keys are stable and empty dates stay undated", () => {
  assert.equal(localDayKey(new Date(2026, 9, 10, 20, 30)), "2026-10-10");
  assert.equal(localDayKey(null), null);
  assert.equal(localDayKey(""), null);
  assert.equal(localDayKey("not-a-date"), null);
});

test("words are grouped by their saved date, not by review time", () => {
  const cards = [
    { id: 1, savedAt: "2026-10-10T10:00:00.000Z", nextReviewAt: "2026-10-15T10:00:00.000Z" },
    { id: 2, savedAt: "2026-10-10T11:00:00.000Z", nextReviewAt: "2026-11-11T10:00:00.000Z" },
    { id: 3, savedAt: null },
  ];
  const groups = groupBySavedDay(cards);
  assert.equal(groups.get(localDayKey(cards[0].savedAt)).length, 2);
  assert.equal(groups.get("undated").length, 1);
});

test("date sorting keeps the source immutable", () => {
  const cards = [
    { id: 1, savedAt: "2026-10-09T10:00:00Z" },
    { id: 2, savedAt: "2026-10-10T10:00:00Z" },
    { id: 3, savedAt: "2026-10-08T10:00:00Z" },
  ];
  assert.deepEqual(sortSavedCards(cards).map((card) => card.id), [2, 1, 3]);
  assert.deepEqual(sortSavedCards(cards, "oldest").map((card) => card.id), [3, 1, 2]);
  assert.deepEqual(cards.map((card) => card.id), [1, 2, 3]);
});

test("calendar day titles are readable", () => {
  assert.equal(dateTitle("2026-10-10"), "October 10, 2026");
  assert.equal(dateTitle("undated"), "Undated");
});
