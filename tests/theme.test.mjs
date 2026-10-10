import test from "node:test";
import assert from "node:assert/strict";
import { loadSettings, saveSettings } from "../services/settingsService.js";

/** Creates isolated storage so theme tests cannot affect real preferences. */
function fakeStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.get(key) ?? null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
  };
}

test("light remains the default for new and invalid preferences", () => {
  globalThis.localStorage = fakeStorage();
  assert.equal(loadSettings().theme, "light");
  localStorage.setItem("hebrewReaderSettings", JSON.stringify({ theme: "unknown" }));
  assert.equal(loadSettings().theme, "light");
});

test("dark selection survives reload without losing previous settings", () => {
  globalThis.localStorage = fakeStorage();
  const before = loadSettings();
  before.ocrEngine = "google-vision";
  before.theme = "dark";
  saveSettings(before);
  const next = loadSettings();
  assert.equal(next.theme, "dark");
  assert.equal(next.ocrEngine, "google-vision");
  assert.deepEqual(next.translationLanguages, ["uk", "en", "ru"]);
});

test("malformed stored preferences fall back safely", () => {
  globalThis.localStorage = fakeStorage();
  localStorage.setItem("hebrewReaderSettings", "{not-json");
  assert.equal(loadSettings().theme, "light");
});
