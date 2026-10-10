import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:8765";
const output = "ui-preview";
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
      if (width === 1448) {
        const expectedSidebar = await page.locator("html").getAttribute("data-theme") === "dark"
          ? 235 : 270;
        assert.ok(Math.abs(dimensions.sidebar - expectedSidebar) < 2,
          `${view}: expected ${expectedSidebar}px sidebar, got ${dimensions.sidebar}px`);
      }
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

    const paintedAssets = await page.evaluate(async () => {
      const output = [];
      for (const selector of [".brand-block img", ".sidebar-illustration img", ".read-heading .reading-still-life"]) {
        const element = document.querySelector(selector);
        if (!element) throw new Error("Missing design artwork: " + selector);
        await element.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 48;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(element, 0, 0, 48, 48);
        const pixels = context.getImageData(0, 0, 48, 48).data;
        let painted = 0;
        const tones = new Set();
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] > 60) {
            painted += 1;
            tones.add([pixels[i] >> 4, pixels[i + 1] >> 4, pixels[i + 2] >> 4].join("-"));
          }
        }
        output.push({
          selector,
          painted,
          uniqueTones: tones.size,
          naturalWidth: element.naturalWidth,
          displayWidth: element.getBoundingClientRect().width,
          cornerAlpha: pixels[3],
        });
      }
      return output;
    });
    for (const asset of paintedAssets) {
      assert.ok(asset.painted > 250 && asset.uniqueTones > 12,
        `Artwork is missing visible painted pixels: ${JSON.stringify(asset)}`);
    }

    for (const asset of paintedAssets) {
      if (width > 700) {
        assert.ok(asset.naturalWidth >= asset.displayWidth * 2,
          `Artwork must be at least 2× display resolution: ${JSON.stringify(asset)}`);
      }
      if (asset.selector !== ".read-heading .reading-still-life") {
        assert.ok(asset.cornerAlpha < 25,
          `Watercolor art must have transparent corners, not a colored rectangle: ${JSON.stringify(asset)}`);
      }
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
    // Verify that appearance is a real persisted preference on every screen.
    await page.locator("#themeToggle").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    assert.equal(await page.locator("#themeToggle").getAttribute("aria-pressed"), "true");
    const darkSurface = await page.locator("#studyCard").evaluate((element) =>
      getComputedStyle(element).backgroundColor);
    assert.notEqual(darkSurface, "rgb(255, 253, 249)");
    await check("Dark Study", "dark-study.png");
    await page.locator("#studyReveal").click();
    await page.locator('[data-rating="good"]').waitFor({ state: "visible" });
    await check("Dark Study answer", "dark-study-answer.png");
    await page.locator('[data-rating="good"]').click();
    await page.locator("#studyProgressLabel").getByText("2 of 2").waitFor();

    await page.locator("#navRead").click();
    await check("Dark Read", "dark-read.png");
    await page.locator("#pasteText").fill("שלום עולם. אני קורא ספר.");
    await page.locator("#loadPasteButton").click();
    await page.locator("#reader .word-token").first().click();
    await page.locator("#wordPanel:not(.hidden)").waitFor();
    if (width === 1448) await page.screenshot({ path: `${output}/dark-word-panel.png`, fullPage: true });
    await page.locator("#closeWordPanelButton").click();
    await page.locator("#navSaved").click();
    await check("Dark Saved Words", "dark-saved-words.png");
    await page.locator("#navCalendar").click();
    const quietDay = await page.locator(".calendar-day:not(.has-words)").first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const colorChannels = (quietDay.match(/\\d+/g) || []).map(Number);
    assert.ok(colorChannels.slice(0, 3).every((channel) => channel < 75),
      "Inactive calendar cells must remain dark, not action-red: " + quietDay);
    await check("Dark Calendar", "dark-calendar.png");
    await page.locator(".calendar-day.has-words").first().click();
    await check("Dark Day words", "dark-day-words.png");

    await page.reload({ waitUntil: "domcontentloaded" });
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    const [masthead, sidebarArt, logoArt] = await Promise.all(
      ["dark-masthead.webp", "dark-sidebar.webp", "dark-skeleton-logo.webp"].map(
        (name) => page.evaluate(async (file) =>
          (await fetch("/assets/" + file)).ok, name),
      ),
    );
    assert.ok(masthead && sidebarArt && logoArt, "Dark theme assets must be available.");

    // Modal appearance setting must also update the global theme and remain in sync.
    await page.locator("#openSettingsButton").click();
    if (width === 1448) await page.screenshot({ path: `${output}/dark-settings.png`, fullPage: true });
    await page.locator('input[name="appearance"][value="light"]').check();
    await page.locator("#saveSettingsButton").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
    assert.equal(await page.locator("#themeToggle").getAttribute("aria-pressed"), "false");
    await page.locator("#closeSettingsButton").click();

    assert.deepEqual(errors, [], `${width}px browser errors`);
    await context.close();
    console.log(`✓ ${width}px: Read → Saved Words → Calendar → Day → Study; assets and layout valid.`);
  }
} finally {
  await browser?.close();
  server.kill();
}
