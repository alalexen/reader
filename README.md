# Hebrew Reader

Hebrew Reader is a browser-based Hebrew study tool for reading text from photos, listening to Hebrew, translating selected words and sentences, and saving vocabulary.

## Requirements

**Python 3.12 is required.**

The project is pinned to Python 3.12 because the local Hebrew morphology stack uses HebPipe 4.0.2.0 and its legacy Hebrew segmentation model format.

You also need:

- a modern browser
- internet access during the first setup
- Git
- optional: Google Cloud credentials for Google Vision OCR, WaveNet TTS, and Google Translation

No model training is required. The setup script downloads the pretrained Hebrew segmentation models automatically.

## Quick start

Clone the repository and switch to the current feature branch:

```bash
git clone https://github.com/alalexen/reader.git
cd reader
git switch feature/mvp-reader
```

Create the local environment:

### macOS / Linux

```bash
python3.12 scripts/setup.py
source .venv/bin/activate
python server.py
```

### Windows

```powershell
py -3.12 scripts/setup.py
.\.venv\Scripts\activate
python server.py
```

Then open:

```text
http://localhost:8000
```

The setup script deliberately recreates `.venv` so that dependency versions are reproducible.

## Main features

- photo upload and image cropping
- Local Tesseract OCR
- optional Google Vision OCR
- editable right-to-left Hebrew text
- clickable Hebrew words
- browser Hebrew speech and optional Google WaveNet voices
- 0.5×, 1×, 1.5×, and 2× speech rates
- Google Translation with MyMemory fallback
- local Hebrew morphological segmentation
- Reverso Context external link
- local flashcards
- Quizlet-compatible text export
- persistent user settings

## Project structure

```text
reader/
├── app.js
├── index.html
├── server.py
├── styles.css
├── requirements.txt
├── THIRD_PARTY_NOTICES.md
├── backend/
│   ├── __init__.py
│   ├── google_cloud.py
│   ├── http_handler.py
│   └── morphology.py
├── scripts/
│   └── setup.py
├── services/
│   ├── flashcardsService.js
│   ├── hebrewMorphologyService.js
│   ├── imageProcessingService.js
│   ├── ocrService.js
│   ├── settingsService.js
│   ├── speechService.js
│   └── translationService.js
├── ui/
│   ├── elements.js
│   ├── flashcardsController.js
│   ├── imageController.js
│   ├── readerController.js
│   ├── sessionTimer.js
│   ├── settingsController.js
│   └── speechController.js
└── utils/
    └── hebrew.js
```

`app.js` is now the composition root: it owns shared UI state and wires controllers together. Browser API/data logic lives in `services/`, DOM-focused behavior lives in `ui/`, and small Hebrew text helpers live in `utils/`. `server.py` is now only the server entry point; request handling, Google Cloud clients, and Hebrew morphology live in `backend/`.

## Hebrew morphology

The word-structure panel uses the Hebrew segmentation resources distributed for HebPipe 4.0.2.0. HebPipe itself uses RFTokenizer for this segmentation step, so Hebrew Reader pins **RFTokenizer 2.2.0** because that version supports HebPipe's legacy `.sm3` model format.

The app does not load HebPipe's full NLP pipeline, dependency parser, NER, or coreference stack. Only the resources needed for word segmentation are installed and loaded.

Morphological segmentation is automatic and can be wrong. The UI explicitly labels it as a possible word structure rather than a definitive linguistic analysis.

Check the local morphology backend:

```text
http://localhost:8000/api/morphology/status
```

A healthy response contains:

```json
{
  "available": true,
  "provider": "hebpipe"
}
```

## OCR

Local Tesseract is the default OCR engine and runs in the browser. Google Vision is optional.

When Google Vision is selected and unavailable, the app falls back to local Tesseract.

Backend status:

```text
http://localhost:8000/api/ocr/status
```

## Translation

Google Cloud Translation NMT is the default translation provider when configured. MyMemory is available as an alternative and as a fallback.

Supported target languages:

- Ukrainian
- English
- Russian

The app translates the selected full word as written. The morphology panel is informational and does not rewrite the text sent to Google Translation.

## Speech

The app can use Hebrew voices exposed by the browser's Web Speech API.

When Google Cloud Text-to-Speech is configured, Google Hebrew WaveNet voices are also available.

Backend status:

```text
http://localhost:8000/api/tts/status
```

## Optional Google Cloud setup

Google Cloud is not required for the core local app.

To use Google Vision, Google Translation, or Google WaveNet, configure Application Default Credentials:

```bash
gcloud auth application-default login
```

Enable only the APIs you want:

```bash
gcloud services enable vision.googleapis.com
gcloud services enable translate.googleapis.com
gcloud services enable texttospeech.googleapis.com
```

The corresponding Python clients are installed by `scripts/setup.py`.

## Local data and privacy

Flashcards and settings are stored in browser `localStorage`.

Images are sent to Google only when Google Vision OCR is selected. Text is sent to the selected translation provider when a translation is requested. Browser TTS remains local to the browser; Google WaveNet sends requested text to Google Cloud.

## Dependency notes

Direct Python dependencies are declared in `requirements.txt`.

HebPipe 4.0.2.0 is installed separately with `--no-deps` by `scripts/setup.py`. Hebrew Reader does not use HebPipe's full NLP pipeline, but the selected Hebrew segmentation model itself uses RFTokenizer + Flair/BERT features. For reproducibility, the compatible ML versions are pinned in `requirements.txt`, including scikit-learn 1.4.1.post1, Pandas 2.2.3, Flair 0.13.0, Torch 2.2.1, and Transformers 4.35.2. Stanza and DiaParser are not required by the app's segmentation path.

The setup script downloads both pretrained Hebrew morphology assets used by the model: `heb.sm3` (RFTokenizer segmentation model) and `heb.seg` (Flair segmentation model), then runs a real morphology probe before reporting success.

The distributed `heb.seg` checkpoint contains a Windows-specific serialized path. The backend applies a narrow compatibility shim only while loading that pretrained checkpoint on macOS/Linux, then immediately restores the standard `pathlib` behavior.

## Third-party licenses

HebPipe code is licensed under Apache License 2.0. RFTokenizer code is also licensed under Apache License 2.0.

HebPipe explicitly notes that language-model resources can have separate licensing terms. RFTokenizer's upstream documentation states that its Hebrew segmentation experiment data is derived from the Universal Dependencies Hebrew Treebank, which is distributed under CC BY-NC-SA 4.0.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the detailed attribution and license notes.
