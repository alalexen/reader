import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

test("every required DOM reference has an HTML ID", () => {
  const html = source("index.html");
  const elements = source("ui/elements.js");
  const ids = [...elements.matchAll(/requiredElement\("#([^"]+)"\)/g)].map((match) => match[1]);
  const actualIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  assert.equal(ids.length, new Set(ids).size, "Required element bindings should not repeat");
  for (const id of ids) assert.ok(actualIds.has(id), "Missing HTML element: " + id);
  assert.equal(actualIds.size, [...html.matchAll(/\bid="([^"]+)"/g)].length, "HTML IDs must be unique");
});

test("old inline flashcard and review blocks are removed", () => {
  const html = source("index.html");
  assert.doesNotMatch(html, /id="flashcardsList"/);
  assert.doesNotMatch(html, /id="reviewSection"/);
  assert.match(html, /data-page="saved"/);
  assert.match(html, /data-page="calendar"/);
  assert.match(html, /data-page="day"/);
  assert.match(html, /data-page="study"/);
  assert.match(html, /שלום!/);
});

test("all central vocabulary controller element names are bound", () => {
  const elements = source("ui/elements.js");
  const controller = source("ui/vocabularyController.js");
  const declared = new Set([...elements.matchAll(/^\s*(\w+): requiredElement/gm)].map((m) => m[1]));
  const names = [...controller.matchAll(/elements\.(\w+)/g)].map((m) => m[1]);
  for (const name of names) assert.ok(declared.has(name), "Unbound UI reference: " + name);
});
