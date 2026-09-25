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
- Show Hebrew usage examples from Tatoeba
- Open the selected word directly in Reverso Context
- Show English dictionary definitions from Wiktionary
- Show morphology for words covered by the local morphology lexicon

The morphology card can display:

- dictionary form
- infinitive
- root
- part of speech
- binyan
- tense
- person
- gender
- number

## Project structure

```text
reader/
├── index.html
├── styles.css
├── app.js
├── data/
│   └── morphologyLexicon.js
├── services/
│   ├── dictionaryService.js
│   ├── examplesService.js
│   ├── imageProcessingService.js
│   ├── morphologyService.js
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
- `data/` contains local data that can later be replaced by a real morphology provider.

This means a future DictaBERT or other morphology backend can replace `morphologyService.js` without rewriting the reader UI.

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
python3 -m http.server 8000
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
python3 -m http.server 8000
```

Edit the files in VS Code or another editor and refresh `http://localhost:8000` to see your changes.

## Technology

- HTML
- CSS
- Vanilla JavaScript with ES modules
- Tesseract.js
- Web Speech API
- MyMemory Translation API
- Tatoeba API
- Wikimedia / Wiktionary API

No paid backend or private API key is required for the current MVP.

## Morphology limitations

The current morphology provider is intentionally conservative.

It uses a small local lexicon for known forms such as `הלכתי`. If the word is unknown, the application does not invent a root or infinitive. Hebrew morphology contains irregular and ambiguous forms, so guessing would produce misleading study material.

The next production-grade step is to connect the existing `morphologyService.js` interface to a full Hebrew NLP model such as DictaBERT or another suitable backend.

## Translation behavior

Translations are requested only when the user clicks a translation button and are cached in memory for the current browser session.

The free translation service has usage limits, so translation quality and availability may vary.

## Privacy

OCR runs in the browser. The uploaded image is not intentionally stored by this application.

Selected text is sent to the configured translation service only when the user requests a translation.


## Word reference sources

The selected-word panel currently uses separate sources for separate jobs:

- MyMemory provides automatic Ukrainian, English, and Russian translations.
- Wiktionary provides dictionary definitions when an English Wiktionary entry exists for the Hebrew form.
- Tatoeba provides Hebrew usage examples through its public API.
- Reverso Context is linked as an external contextual reference. The project does not scrape or call an undocumented Reverso endpoint.

Keeping these integrations in separate services makes them easy to replace later.
