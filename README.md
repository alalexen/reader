# Hebrew Reader

Hebrew Reader is a free browser-based learning tool for reading Hebrew from photos.

## Current MVP

- Upload a photo of a Hebrew book page
- Choose Local Tesseract OCR by default or Google Vision OCR when configured
- Edit OCR output manually
- Render Hebrew text right-to-left
- Click individual Hebrew words
- Speak the full text or one selected word
- Use Google Hebrew WaveNet voices when Google Cloud TTS is configured, with browser Hebrew voices as a fallback
- Use speech speeds of 0.5×, 1×, 1.5×, and 2×
- Translate words and sentences with Google NMT or MyMemory
- Show sentence-aware Hebrew morphological segmentation for selected words
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
│   ├── hebrewMorphologyService.js
│   ├── imageProcessingService.js
│   ├── ocrService.js
│   ├── settingsService.js
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

### 3. Install the local Python environment on macOS

HebPipe 4.0.2.0 requires Python 3.12 and has an upstream dependency conflict between
`stanza` and `diaparser`. The project setup script follows HebPipe's own Docker
installation strategy: it installs the compatible runtime dependencies first, then
installs DiaParser and HebPipe without re-running their conflicting dependency metadata.

Install Python 3.12 if needed:

```bash
brew install python@3.12
```

Then run:

```bash
bash scripts/setup_macos.sh
```

The setup script recreates `.venv` with Python 3.12, installs all required Python
packages, and downloads HebPipe's pretrained Hebrew model files. No model training is
required.

Note: `pip check` may still report DiaParser's published `stanza` pin as incompatible with
HebPipe's newer `stanza` version. HebPipe's own Docker setup intentionally installs
DiaParser with `--no-deps` to avoid enforcing that stale metadata pin.

### 4. Start the local web server

Do not open `index.html` directly from Finder because the project uses JavaScript modules.

```bash
source .venv/bin/activate
python server.py
```

### 5. Open the app

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
source .venv/bin/activate
python server.py
```

Re-run `bash scripts/setup_macos.sh` only when the Python environment or pinned
dependencies need to be rebuilt.

Edit the files in VS Code or another editor and refresh `http://localhost:8000` to see your changes.

## Technology

- HTML
- CSS
- Vanilla JavaScript with ES modules
- Tesseract.js
- Google Cloud Vision (optional primary OCR backend)
- Google Cloud Text-to-Speech (optional WaveNet backend)
- Web Speech API fallback
- Google Cloud Translation NMT (primary translation backend)
- MyMemory Translation API fallback
- HebPipe 4.0.2.0 for local Hebrew morphological analysis

The core app still works without Google Cloud. Google Cloud Text-to-Speech, Vision, and Translation are optional and require a Google Cloud project with billing enabled. Local Tesseract is the default OCR engine. Google Vision can be selected in the UI and falls back to Tesseract if unavailable. Browser Hebrew speech remains available without Google TTS.

## Translation behavior

Translations use Google Cloud Translation NMT when selected in Settings and fall back to MyMemory if Google Translation is unavailable. Only the languages selected in Settings are requested, so choosing one language sends one translation request, two languages send two, and three languages send three.

Enable Google Translation:

```bash
gcloud services enable translate.googleapis.com
```

The Google Translation client is installed by `scripts/setup_macos.sh`.

## Privacy

When Google Vision is available, the selected image is sent to Google Cloud only when OCR is requested. If Google Vision is unavailable, OCR falls back to Tesseract.js in the browser. The image is not intentionally stored by this application.

Selected text is sent to the configured translation service only when the user requests a translation.


## Word reference

- MyMemory provides automatic Ukrainian, English, and Russian translations.
- Reverso Context is available only as an external website link for the selected word.
- Hebrew Reader does not fetch, parse, proxy, or display Reverso example text inside the app.


## Flashcards and Quizlet

Flashcards are stored in the browser with `localStorage`. Each saved card contains the Hebrew word, Ukrainian/English/Russian translations, and the original sentence from the uploaded text.

Quizlet does not currently expose a self-service public API for independent apps to create sets. Hebrew Reader therefore uses Quizlet's supported text-import workflow: click **Copy for Quizlet**, open Quizlet, create a flashcard set, choose **Import**, and paste the copied text.


## Google Vision OCR

Local Tesseract is the default OCR engine. Google Vision can be selected from **Text recognition** or **Settings**. If Google Vision is unavailable, Hebrew Reader automatically falls back to local Tesseract.js.

Enable the API:

```bash
gcloud services enable vision.googleapis.com
```

The Google Vision client is installed by `scripts/setup_macos.sh`.

The same Application Default Credentials used for Google TTS are used for Vision OCR.

Check the backend:

```text
http://localhost:8000/api/ocr/status
```

## System Hebrew voice

Hebrew Reader can use Hebrew voices installed in the operating system through the browser's Web Speech API.

### macOS

1. Open **System Settings → Accessibility → Read & Speak**.
2. Set the speech language to **Hebrew**.
3. Download a Hebrew system voice if needed.
4. Fully quit and reopen the browser.
5. Restart Hebrew Reader and select the Hebrew voice in **Voice**.

### Windows

1. Open **Settings → Time & language → Speech**.
2. Add or install a **Hebrew** speech voice if available.
3. Restart the browser.
4. Restart Hebrew Reader and select the Hebrew voice in **Voice**.

## Google Hebrew voices

Google Cloud Text-to-Speech is optional. It requires a Google Cloud project with billing enabled.

### macOS and Windows

Install the Google Cloud CLI, then open Terminal on macOS or PowerShell on Windows.

Select your Google Cloud project:

```bash
gcloud config set project YOUR_PROJECT_ID
```

Enable Cloud Text-to-Speech:

```bash
gcloud services enable texttospeech.googleapis.com
```

Create local Application Default Credentials:

```bash
gcloud auth application-default login
```

If browser login does not complete correctly, use:

```bash
gcloud auth application-default login --no-browser
```

Follow the terminal instructions and complete the Google consent flow.

Set the quota project:

```bash
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

Verify the credentials:

```bash
gcloud auth application-default print-access-token >/dev/null && echo "ADC OK"
```

### Run on macOS

```bash
bash scripts/setup_macos.sh
source .venv/bin/activate
python server.py
```

### Run on Windows

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python server.py
```

Open:

```text
http://localhost:8000
```

When Google credentials are available, the **Voice** selector includes both the system Hebrew voice and Google Hebrew voices. The system voice remains the default unless another voice is selected.


## Settings

Open **Settings** with the gear button in the top-right corner.

Settings include:

- translation model: Google NMT or MyMemory
- text recognition: Local Tesseract or Google Vision
- voice: system Hebrew voices and Google Hebrew voices
- translation languages: choose 1 to 3 from Ukrainian, English, and Russian

The existing **Text recognition** and **Voice** dropdowns remain available in the main interface.


## Hebrew morphology with HebPipe

When a Hebrew word is selected, Hebrew Reader sends the selected word together with its surrounding sentence to the local Python backend. The backend uses HebPipe's Hebrew segmentation model and returns the segmentation for the selected word.

There is no spelling-based fallback. If HebPipe is unavailable or does not produce a useful segmentation, Hebrew Reader hides the word-structure hint instead of guessing.

HebPipe is installed by `scripts/setup_macos.sh`. The script uses Python 3.12,
installs HebPipe's compatible CPU dependency set, and follows HebPipe's official
workaround for its published `stanza` / `diaparser` resolver conflict.

HebPipe model files are not bundled with this repository. The setup script invokes
HebPipe's own model download flow and stores the pretrained models locally. No training
is required.

Check the local morphology backend:

```text
http://localhost:8000/api/morphology/status
```

A response with `"available": true` means both the package and the Hebrew segmentation model are available. A `model_missing` response means HebPipe is installed but its local model still needs to be downloaded.


## Third-party licenses

This personal, non-commercial project uses third-party open-source software.

HebPipe 4.0.2.0 is installed as a Python dependency. HebPipe code is licensed under Apache License 2.0. The HebPipe license explicitly notes that some language-model resources may use different licenses.

HebPipe model files are downloaded locally and are not committed to this repository. Transitive packages installed by HebPipe retain their own upstream licenses.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and license details.
