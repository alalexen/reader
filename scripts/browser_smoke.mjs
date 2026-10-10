import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:8765";
const output = ".visual-check";
await mkdir(output, { recursive: true });

const date = new Date();
date.setHours(12, 0, 0, 0);
const card = {
  id: 101,
  word: "ספר",
  sentence: "אני קורא ספר מעניין בערב.",
  savedAt: date.toISOString(),
  translations: { en: "book", ru: "книга", uk: "книга" },
  state: "learning",
  nextReviewAt: null,
};
const cards = [card, { ...card, id: 102, word: "ללמוד", translations: {
  en: "to learn", ru: "учиться", uk: "вчитися",
} }];
const server = spawn("python", ["-m", "http.server", "8765", "--bind", "127.0.0.1"], {
  stdio: "ignore",
});

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      if ((await fetch(baseUrl)).ok) return;
    } catch { /* HTTP server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Static preview server did not start.");
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  for (const width of [1448, 2048, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 1086 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("hebrewReaderFlashcardsImportedToPostgresV1", "true");
    });
    await page.route("**/cdn.jsdelivr.net/**", (route) => route.abort());
    await page.route("**/api/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const body = pathname === "/api/flashcards" || pathname === "/api/flashcards/import"
        ? cards
        : pathname.startsWith("/api/review/")
          ? card
          : { available: false };
      return route.fulfill({
        status: 200, contentType: "application/json", body: JSON.stringify(body),
      });
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.querySelector("#savedWordsCount")?.textContent?.includes("2 words saved"), null, { timeout: 15000 });

    async function check(view, filename) {
      const dimensions = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        sidebar: document.querySelector(".workspace-sidebar").getBoundingClientRect().width,
        main: document.querySelector(".workspace-main").getBoundingClientRect().toJSON(),
        heading: document.querySelector('[data-page]:not(.hidden) .page-heading h1')?.getBoundingClientRect().toJSON(),
        image: [...document.querySelectorAll('[data-page]:not(.hidden) img[src]')].map((img) => ({
          src: img.getAttribute("src"), width: img.naturalWidth, ready: img.complete,
        })),
      }));
      assert.ok(dimensions.document <= dimensions.viewport + 2,
        `${width}px ${view}: page overflows horizontally (${dimensions.document}px)`);
      if (width === 1448) assert.ok(Math.abs(dimensions.sidebar - 270) < 2);
      if (width > 700) {
        assert.ok(dimensions.main.x >= dimensions.sidebar,
          `${width}px ${view}: main is hidden behind sidebar`);
      }
      assert.ok(dimensions.heading.width < dimensions.viewport, "Heading overflows");
      for (const image of dimensions.image) {
        assert.ok(image.ready && image.width > 0, "Broken design image: " + image.src);
      }
      if (width === 1448) await page.screenshot({ path: `${output}/${filename}`, fullPage: true });
    }

    await check("Read", "read.png");
    await page.locator("#navSaved").click();
    await page.locator("#savedWordsGroups .vocab-row").first().waitFor();
    await check("Saved Words", "saved-words.png");
    await page.locator("#navCalendar").click();
    await page.locator(".calendar-day.has-words").first().waitFor();
    await check("Word Calendar", "calendar.png");
    await page.locator(".calendar-day.has-words").first().click();
    await page.locator("#dayView:not(.hidden)").waitFor();
    await check("Day words", "day-words.png");
    await page.locator("#studyDayButton").click();
    await page.locator("#studyView:not(.hidden)").waitFor();
    await check("Study", "study.png");
    assert.deepEqual(errors, [], `${width}px browser errors`);
    await context.close();
    console.log(`✓ ${width}px: Read → Saved Words → Calendar → Day → Study; assets and layout valid.`);
  }
} finally {
  await browser?.close();
  server.kill();
}
