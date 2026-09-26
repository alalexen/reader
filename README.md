# Hebrew Reader

Hebrew Reader is a browser-based tool for studying Hebrew from real text: upload a page, recognize the Hebrew, listen to it, click individual words, inspect possible word segmentation, translate words or sentences, and save vocabulary.

## Setup

**Python 3.12 is required.**

From the project root, create the local environment:

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

Open:

```text
http://127.0.0.1:8000
```

The setup script recreates `.venv`, installs the Python dependencies, installs the compatible HebPipe 4.0.2.0 segmentation stack, downloads the pretrained Hebrew segmentation models, and runs a real morphology probe before reporting success.

## Default configuration

The application can run without Google Cloud credentials.

| Feature | Default behavior | Notes |
| --- | --- | --- |
| Text recognition | Local Tesseract.js | Runs in the browser. It is convenient, but book photos, niqqud, skew, shadows, small print, or low contrast can produce recognition errors. |
| Voice | Hebrew voice exposed by the browser / operating system | The app automatically prefers an available Hebrew voice. Voice quality and availability depend on the machine and browser. |
| Translation | Google NMT is selected in Settings; if the local Google backend is unavailable, the app falls back to MyMemory | The fallback keeps translation usable without credentials, but results can be less consistent than Google Cloud Translation. |
| Word structure | Local HebPipe segmentation | This is an automatic possible decomposition, not a definitive linguistic analysis. |
| Flashcards | Browser localStorage | Saved locally in the current browser profile. |

### Using the default voice

No backend configuration is required for system speech.

After starting the app, check the **Voice** selector. Hebrew voices exposed by the browser are listed automatically and the app selects a preferred Hebrew voice when one is available.

If the selector does not show a named Hebrew voice, the operating system/browser is not exposing one. Add or enable a Hebrew speech voice in the operating system and reload the page, or configure Google Cloud Text-to-Speech as described below.

The default speech rate is **1×**. The UI also supports **0.5×**, **1.5×**, and **2×**.

### Using the app without Google Cloud

For a completely non-Google configuration:

1. Keep **Text recognition** set to **Local Tesseract**.
2. Choose one of the available system Hebrew voices in **Voice**.
3. In **Settings → Translation model**, choose **MyMemory** if you want to skip the failed Google attempt and use the fallback directly.

Tesseract.js is loaded from jsDelivr, and its OCR resources may be downloaded by the browser when needed. The HebPipe models are downloaded by `scripts/setup.py`.

## Recommended: Google Cloud for better OCR, speech, and translation

The local/default tools are useful for development and basic reading, but OCR, system speech, and the public translation fallback can all vary in quality. For regular use, Google Cloud is strongly recommended.

The application already contains the Google client libraries. You only need to configure a Google Cloud project and Application Default Credentials.

### 1. Prepare a Google Cloud project

Use a Google Cloud project with billing enabled, then authenticate the Google Cloud CLI:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Enable the three APIs used by Hebrew Reader:

```bash
gcloud services enable \
  vision.googleapis.com \
  translate.googleapis.com \
  texttospeech.googleapis.com
```

The backend uses:

- **Cloud Vision API** for Hebrew OCR
- **Cloud Translation Basic (v2)** for translation
- **Cloud Text-to-Speech** for Hebrew WaveNet voices

### 2. Configure local credentials

Create Application Default Credentials:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

Restart the local server after configuring credentials:

```bash
python server.py
```

Then reload the browser page.

### 3. Verify the backend

These endpoints report whether the local backend can initialize each configured service:

```bash
curl http://127.0.0.1:8000/api/tts/status
curl http://127.0.0.1:8000/api/ocr/status
curl http://127.0.0.1:8000/api/translate/status
curl http://127.0.0.1:8000/api/morphology/status
```

For a configured service, the response should contain:

```json
{
  "available": true
}
```

The Google status checks confirm that the local server can create the authenticated client. A real API request can still fail if the API is disabled, billing is unavailable, permissions are insufficient, or a quota is exhausted.

### 4. Select the Google providers in the app

Open **Settings** using the gear button.

For the recommended configuration:

- **Translation model:** Google NMT
- **Text recognition:** Google Vision
- **Voice:** choose one of the Google WaveNet Hebrew voices

The application exposes the configured Hebrew WaveNet A, B, C, and D voices when the local TTS backend is available.

If Google Vision fails during OCR, the application automatically retries with local Tesseract. If Google Translation fails, it automatically falls back to MyMemory. If a selected Google voice fails, speech falls back to a browser Hebrew voice when one is available.

## OCR tips

OCR quality depends heavily on the source image. For better results:

- crop to the actual text area before recognition;
- keep the page straight and fill most of the image;
- avoid strong shadows, blur, and perspective distortion;
- review the recognized text in the editor before switching to clickable reading mode.

Local Tesseract is the default OCR engine. Google Vision can be selected from the page or from Settings.

## Hebrew morphology

The word-structure panel uses Hebrew segmentation resources distributed for HebPipe 4.0.2.0.

Hebrew Reader loads only the segmentation-related resources it needs rather than HebPipe's full NLP pipeline. RFTokenizer 2.2.0 is pinned because it supports the legacy `.sm3` Hebrew segmentation model used here.

Morphological segmentation can be wrong. The UI intentionally labels the result as **Possible word structure** rather than presenting it as a definitive analysis.

A healthy local morphology endpoint looks like:

```text
http://127.0.0.1:8000/api/morphology/status
```

with a response containing:

```json
{
  "available": true,
  "provider": "hebpipe"
}
```

## Translation behavior

Supported target languages are:

- Ukrainian
- English
- Russian

The selected Hebrew word is translated as written. Morphological segmentation is informational and does not modify the text sent to the translation provider.

Google NMT is the preferred provider. MyMemory can be selected directly and is also used automatically as a fallback when Google Translation is unavailable.

## Speech behavior

The app supports two speech paths:

- browser/OS Hebrew voices through the Web Speech API;
- Google Hebrew WaveNet through the local Python backend.

When a Google WaveNet voice is selected, long text is split into smaller chunks before synthesis. Pressing **Stop** cancels both browser speech and active Google audio/request handling.

## Local data and privacy

Flashcards and settings are stored in browser `localStorage`.

Images are sent to Google only when Google Vision is selected. Text is sent to the selected translation provider when translation is requested. Browser speech uses the browser/OS speech implementation; selecting a Google WaveNet voice sends the requested Hebrew text to Google Cloud Text-to-Speech.

## Project structure

```text
reader/
├── app.js
├── index.html
├── server.py
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
├── styles.css
├── styles/
│   ├── core.css
│   ├── theme.css
│   └── features.css
└── utils/
    └── hebrew.js
```

`app.js` is the composition root and wires the UI controllers together. Browser/API integrations live in `services/`, DOM-focused behavior lives in `ui/`, and the Python backend is separated into request handling, Google Cloud clients, and Hebrew morphology.

## Dependency notes

Direct Python dependencies are declared in `requirements.txt`.

HebPipe 4.0.2.0 is installed separately with `--no-deps` by `scripts/setup.py`. The selected Hebrew segmentation model uses RFTokenizer and Flair/BERT components, so the compatible ML versions are pinned, including scikit-learn 1.4.1.post1, Pandas 2.2.3, Flair 0.13.0, Torch 2.2.1, and Transformers 4.35.2.

The setup script downloads both Hebrew morphology assets used by this project:

- `heb.sm3` — RFTokenizer segmentation model
- `heb.seg` — Flair segmentation model

The distributed `heb.seg` checkpoint contains a Windows-specific serialized path. On macOS/Linux the backend temporarily applies a narrow `pathlib` compatibility shim while the model is first loaded, then immediately restores the standard behavior.

## Third-party licenses

HebPipe and RFTokenizer code are licensed under Apache License 2.0.

Model/data resources can have separate terms. RFTokenizer's upstream documentation states that its Hebrew segmentation experiment data is derived from the Universal Dependencies Hebrew Treebank, distributed under CC BY-NC-SA 4.0.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for detailed attribution and license notes.
