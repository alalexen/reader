# Hebrew Reader

Hebrew Reader is a free browser-based learning tool for reading Hebrew from photos.

## Current MVP

- Upload a photo of a Hebrew book page
- Run Hebrew OCR directly in the browser with Tesseract.js
- Edit OCR output manually
- Render Hebrew text right-to-left
- Click individual Hebrew words
- Speak the full text or one selected word with the browser Web Speech API
- Change speech speed

## Technology

The first version is intentionally static:

- HTML
- CSS
- Vanilla JavaScript
- Tesseract.js
- Web Speech API

No paid backend is required for the current MVP.

## Run locally

You can open `index.html` directly in a modern browser.

For the most reliable behavior, run a simple local web server. For example:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Planned next steps

1. Ukrainian translation for selected words
2. Ukrainian translation for full sentences
3. Hebrew morphology and dictionary forms
4. Personal vocabulary list
5. Review mode and spaced repetition
6. Better OCR preprocessing for book photos
7. GitHub Pages deployment

## Privacy

In the current MVP, OCR runs in the browser. The uploaded image is not intentionally stored by this application.
