# Hebrew Reader

Hebrew Reader is a free browser-based learning tool for reading Hebrew from photos.

## Current MVP

- Upload a photo of a Hebrew book page
- Run Hebrew OCR directly in the browser with Tesseract.js
- Edit OCR output manually
- Render Hebrew text right-to-left
- Click individual Hebrew words
- Speak the full text or one selected word
- Select from Hebrew voices exposed by the browser or operating system
- Use speech speeds of 0.5×, 1×, 1.5×, and 2×
- Translate words and sentences into Ukrainian, English, and Russian
- Show inline Reverso Context examples through the local proxy
- Open the selected word directly in Reverso Context
- Save selected words to local flashcards
- Speak saved words and their original source sentences
- Copy saved cards in Quizlet's tab-separated import format

## Project structure

```text
reader/
├── index.html
├── styles.css
├── app.js
├── server.py
├── services/
│   ├── examplesService.js
│   ├── flashcardsService.js
│   ├── imageProcessingService.js
│   ├── ocrService.js
│   ├── speechService.js
│   └── translationService.js
└── utils/
    └── hebrew.js
```

The architecture intentionally separates responsibilities:

- `app.js` manages page state and connects UI events to services.
- `services/` contains integrations and application capabilities.
- `utils/` contains small reusable Hebrew text helpers.

## Run locally

### 1. Clone the repository

```bash
git clone https://github.com/alalexen/reader.git
cd reader
```

### 2. Switch to the current feature branch

Until Pull Request #1 is merged:

```bash
git switch feature/mvp-reader
```

After the pull request is merged, you can use:

```bash
git switch main
git pull
```

### 3. Start a local web server

Do not open `index.html` directly from Finder because the project now uses JavaScript modules.

If Python 3 is installed:

```bash
python3 server.py
```

### 4. Open the app

Open this address in your browser:

```text
http://localhost:8000
```

Stop the server with `Control + C` in the terminal.

## Development workflow

A simple workflow for local changes is:

```bash
git switch feature/mvp-reader
git pull
python3 server.py
```

Edit the files in VS Code or another editor and refresh `http://localhost:8000` to see your changes.

## Technology

- HTML
- CSS
- Vanilla JavaScript with ES modules
- Tesseract.js
- Web Speech API
- MyMemory Translation API

No paid backend or private API key is required for the current MVP.

## Translation behavior

Translations are requested only when the user clicks a translation button and are cached in memory for the current browser session.

The free translation service has usage limits, so translation quality and availability may vary.

## Privacy

OCR runs in the browser. The uploaded image is not intentionally stored by this application.

Selected text is sent to the configured translation service only when the user requests a translation.


## Word reference sources

- MyMemory provides automatic Ukrainian, English, and Russian translations.
- Reverso Context is the only usage-example source.
- Inline examples are loaded from Reverso's undocumented `bst-query-service` endpoint.
- The normal Reverso Context page link remains available as a fallback when the inline request fails or changes.
- The project does not use Tatoeba or Wiktionary in the selected-word panel.

The Reverso integration is isolated in `services/examplesService.js` because the endpoint is undocumented and may change without notice.


## Flashcards and Quizlet

Flashcards are stored in the browser with `localStorage`. Each saved card contains the Hebrew word, Ukrainian/English/Russian translations, one Reverso example, and the original sentence from the uploaded text.

Quizlet does not currently expose a self-service public API for independent apps to create sets. Hebrew Reader therefore uses Quizlet's supported text-import workflow: click **Copy for Quizlet**, open Quizlet, create a flashcard set, choose **Import**, and paste the copied text.

## Reverso local proxy

Run the project with `python3 server.py`. The Python server serves the static files and proxies requests to Reverso's undocumented `bst-query-service` endpoint. This avoids browser CORS restrictions while keeping the integration local and free.
