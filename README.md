# Hebrew Reader

Hebrew Reader is a free browser-based learning tool for reading Hebrew from photos.

## Current MVP

- Upload a photo of a Hebrew book page
- Run Hebrew OCR directly in the browser with Tesseract.js
- Edit OCR output manually
- Render Hebrew text right-to-left
- Click individual Hebrew words
- Detect the sentence that contains the selected word
- Translate a selected word into Ukrainian, English, and Russian
- Translate the selected sentence into Ukrainian, English, and Russian
- Speak the full text or one selected word with the browser Web Speech API
- Change speech speed

## Technology

The current version is intentionally static:

- HTML
- CSS
- Vanilla JavaScript
- Tesseract.js
- Web Speech API
- MyMemory Translation API

No paid backend or private API key is required for the current MVP.

## Translation behavior

Translations are requested from the browser only when the user clicks a translation button.

The app currently translates from Hebrew into:

- Ukrainian
- English
- Russian

Translation results are cached in memory for the current browser session to avoid repeating identical requests.

The free translation service has usage limits, so translation quality and availability may vary.

## Run locally

For the most reliable behavior, run a simple local web server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Planned next steps

1. Hebrew morphology and dictionary forms
2. Personal vocabulary list
3. Review mode and spaced repetition
4. Better OCR preprocessing for book photos
5. Improved translation fallback behavior
6. GitHub Pages deployment

## Privacy

OCR runs in the browser. The uploaded image is not intentionally stored by this application.

Selected text is sent to the configured translation service only when the user requests a translation.
