# Hebrew Reader

Hebrew Reader is a browser-based tool for studying Hebrew from real text: upload a page, recognize the Hebrew, listen to it, click individual words, inspect possible word segmentation, translate words or sentences, and save vocabulary.

## Setup

**Python 3.12 and PostgreSQL are required.**

Hebrew Reader manages its own private PostgreSQL cluster for learning data. It does not need to use or restart a system/work PostgreSQL service.

On macOS, if PostgreSQL is not installed:

```bash
brew install postgresql@15
```

On Linux/Windows, install PostgreSQL so `postgres`, `initdb`, `pg_ctl`, `createdb`, and `psql` are available. The bootstrap script also detects Homebrew PostgreSQL installations that are not on `PATH`.

### First setup

macOS / Linux:

```bash
python3.12 scripts/setup.py
source .venv/bin/activate
python scripts/run_hebrew_reader.py
```

Windows:

```powershell
py -3.12 scripts/setup.py
.\.venv\Scripts\activate
python scripts/run_hebrew_reader.py
```

The Python setup recreates `.venv`, installs dependencies, installs the compatible HebPipe 4.0.2.0 segmentation stack, downloads the Hebrew segmentation models, and runs the local test suite.

Then `scripts/run_hebrew_reader.py` performs the application bootstrap automatically:

1. respects an existing `DATABASE_URL` if the user already configured PostgreSQL;
2. otherwise creates a private PostgreSQL cluster under `~/.hebrew-reader/postgres`;
3. binds that managed server only to `127.0.0.1`;
4. chooses a free port starting at `55432`;
5. creates the `hebrew_reader` database if needed;
6. creates the project-local `.env` if needed;
7. applies all Alembic migrations;
8. checks whether web port `8000` is occupied; if it is, stops the listening process (tries a graceful stop first, then a forced stop if needed);
9. starts the Hebrew Reader web server on `http://127.0.0.1:8000`.

The managed cluster runs independently of `brew services`, so Hebrew Reader does not stop, restart, reconfigure, or reuse a work PostgreSQL service.

Open:

```text
http://127.0.0.1:8000
```

### Optional demo data

For a new/empty database:

```bash
python scripts/run_hebrew_reader.py --demo
```

The demo seed creates one short Hebrew text plus a few words, encounters, and starter cards. It is idempotent, and it refuses to seed an already-used database that contains learning data.

The Saved Words, Calendar and Study pages are implemented in `feature/postgres-flashcards` (PR #5), pending final local browser verification. On first load, old browser cards are imported into PostgreSQL in one transaction. Original `localStorage` cards remain as a backup; new saves, deletes and ratings are stored in PostgreSQL.

### Later starts

After the first setup:

```bash
source .venv/bin/activate
python scripts/run_hebrew_reader.py
```

If the managed PostgreSQL cluster was stopped, `run_hebrew_reader.py` starts it again automatically before launching the app. If port `8000` is already occupied, the launcher prints the PID/command it found, stops that listener, waits for the port to become free, and then reuses `8000`.

`Control + C` stops the web server. The managed PostgreSQL process can stay running between sessions. To stop it too:

```bash
python scripts/stop_db.py
```

### Database-only commands

Prepare/start the database without starting the web app:

```bash
python scripts/bootstrap_db.py
```

Prepare it and optionally add demo data:

```bash
python scripts/bootstrap_db.py --demo
```

Apply only Alembic migrations to the configured `DATABASE_URL`:

```bash
python scripts/init_db.py
```

### Using an existing PostgreSQL server

If a user wants to use an existing local or remote PostgreSQL server instead of Hebrew Reader's managed cluster, create `.env` manually:

```text
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/hebrew_reader
```

When `DATABASE_URL` already exists and there is no Hebrew Reader managed-cluster configuration, the bootstrap uses that database and does not modify any PostgreSQL service or data directory.

The repository contains `.env.example` only as a connection-format example. The real `.env` is ignored by Git, so cloning the repository never downloads another user's database connection or learning data.

### Verify the database

With the app running:

```bash
curl http://127.0.0.1:8000/api/database/status
```

A healthy database returns:

```json
{
  "available": true,
  "provider": "postgresql"
}
```

## Pages and navigation

The home page is **Read** only: upload an image, optionally crop it, recognize Hebrew or paste Hebrew text, then click words to translate and save them. The old inline flashcard and review sections have been removed.

The left sidebar contains **Read**, **Saved Words**, **Calendar**, and **Settings**:

- **Saved Words** groups words by their original saved date, newest first. Search, sorting, translations, word audio, deletion, filtering and study for all/selected words are available.
- **Calendar** is a monthly planner showing how many words were added each day. Selecting a day opens its own word list and a **Study these words** action.
- **Study** shows one saved word at a time, its original Hebrew sentence, optional audio, Reveal answer and **Again / Hard / Good / Easy** buttons. Review ratings are persisted in PostgreSQL.

Run tests after updating the branch:

```bash
python -m unittest discover -s tests -v
node --test tests/*.mjs
```

GitHub Actions checks backend tests, JavaScript syntax and HTML/JS element consistency. A real PostgreSQL and browser visual check is still required before merging.

## Default configuration

The application can run without Google Cloud credentials.

| Feature | Default behavior | Notes |
| --- | --- | --- |
| Text recognition | Local Tesseract.js | Runs in the browser. It is convenient, but book photos, niqqud, skew, shadows, small print, or low contrast can produce recognition errors. |
| Voice | Hebrew voice exposed by the browser / operating system | The app automatically prefers an available Hebrew voice. Voice quality and availability depend on the machine and browser. |
| Translation | Google NMT is selected in Settings; if the local Google backend is unavailable, the app falls back to MyMemory | The fallback keeps translation usable without credentials, but results can be less consistent than Google Cloud Translation. |
| Word structure | Local HebPipe segmentation | This is an automatic possible decomposition, not a definitive linguistic analysis. |
| Saved Words and Study | PostgreSQL API (feature branch, pending verification) | The original localStorage cards are imported once and retained as a backup. |

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
python scripts/run_hebrew_reader.py
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

PostgreSQL is the persistent store for the new learning-data model: texts, words, encounters, review cards/history and study sessions. On the flashcard migration branch, the UI reads and writes cards through PostgreSQL. Original browser `localStorage` cards remain untouched as a backup after a confirmed import.

Small UI/preferences data can remain in browser `localStorage`.

Images are sent to Google only when Google Vision is selected. Text is sent to the selected translation provider when translation is requested. Browser speech uses the browser/OS speech implementation; selecting a Google WaveNet voice sends the requested Hebrew text to Google Cloud Text-to-Speech.

The database itself is not committed to Git. `.env` is ignored, while `.env.example` only documents the connection format.

## Project structure

```text
reader/
├── index.html               # Read, Saved Words, Calendar, Day and Study views
├── app.js                   # App composition and event bindings
├── styles.css
├── styles/
│   ├── core.css
│   ├── theme.css
│   ├── features.css
│   └── editorial.css        # Sidebar, word list, planner, study styling
├── assets/
│   ├── rabbit-watercolor.svg
│   ├── sidebar-artwork.svg
│   └── still-life-watercolor.svg
├── ui/
│   ├── navigationController.js
│   ├── vocabularyController.js
│   ├── wordSaveController.js
│   ├── readerController.js
│   ├── imageController.js
│   ├── speechController.js
│   ├── settingsController.js
│   ├── sessionTimer.js
│   └── elements.js
├── services/                # API, OCR, speech, translation, settings
├── utils/                   # Hebrew and local-date grouping helpers
├── backend/                 # SQLAlchemy models and APIs
├── migrations/              # Database revisions
├── scripts/                 # Setup, bootstrap and launcher
└── tests/                   # Python and Node tests
```

Controllers own their respective screens. Saved Word CRUD and study ratings use the Python API and PostgreSQL; legacy inline flashcard and review controllers were removed.

## Dependency notes

Direct Python dependencies are declared in `requirements.txt`.

Persistent learning data uses SQLAlchemy 2, Alembic, Psycopg 3 and PostgreSQL. Schema changes should be added as new Alembic revisions rather than editing an already-applied migration.

HebPipe 4.0.2.0 is installed separately with `--no-deps` by `scripts/setup.py`. The selected Hebrew segmentation model uses RFTokenizer and Flair/BERT components, so the compatible ML versions are pinned, including scikit-learn 1.4.1.post1, Pandas 2.2.3, Flair 0.13.0, Torch 2.2.1, and Transformers 4.35.2.

The setup script downloads both Hebrew morphology assets used by this project:

- `heb.sm3` — RFTokenizer segmentation model
- `heb.seg` — Flair segmentation model

The distributed `heb.seg` checkpoint contains a Windows-specific serialized path. On macOS/Linux the backend temporarily applies a narrow `pathlib` compatibility shim while the model is first loaded, then immediately restores the standard behavior.

## Third-party licenses

HebPipe and RFTokenizer code are licensed under Apache License 2.0.

Model/data resources can have separate terms. RFTokenizer's upstream documentation states that its Hebrew segmentation experiment data is derived from the Universal Dependencies Hebrew Treebank, distributed under CC BY-NC-SA 4.0.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for detailed attribution and license notes.
