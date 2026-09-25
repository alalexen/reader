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
- Open the selected word directly on the Reverso Context website
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


## Word reference

- MyMemory provides automatic Ukrainian, English, and Russian translations.
- Reverso Context is available only as an external website link for the selected word.
- Hebrew Reader does not fetch, parse, proxy, or display Reverso example text inside the app.


## Flashcards and Quizlet

Flashcards are stored in the browser with `localStorage`. Each saved card contains the Hebrew word, Ukrainian/English/Russian translations, and the original sentence from the uploaded text.

Quizlet does not currently expose a self-service public API for independent apps to create sets. Hebrew Reader therefore uses Quizlet's supported text-import workflow: click **Copy for Quizlet**, open Quizlet, create a flashcard set, choose **Import**, and paste the copied text.

