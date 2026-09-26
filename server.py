#!/usr/bin/env python3
"""Local development server for Hebrew Reader, including optional Google Cloud services."""

import importlib.util
import json
import os
import pathlib
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = 8000
MAX_JSON_REQUEST_BYTES = 64_000
MAX_OCR_IMAGE_BYTES = 15_000_000

GOOGLE_HEBREW_VOICES = {
    "he-IL-Wavenet-A",
    "he-IL-Wavenet-B",
    "he-IL-Wavenet-C",
    "he-IL-Wavenet-D",
}

_tts_client = None
_tts_module = None
_vision_client = None
_vision_module = None
_translate_client = None
_hebpipe_runtime = None
_morphology_lock = threading.Lock()


def get_google_tts_client():
    """Return an authenticated Google Cloud Text-to-Speech client."""
    global _tts_client, _tts_module

    if _tts_client is not None:
        return _tts_client, _tts_module

    from google.cloud import texttospeech

    _tts_client = texttospeech.TextToSpeechClient()
    _tts_module = texttospeech
    return _tts_client, _tts_module


def get_google_vision_client():
    """Return an authenticated Google Cloud Vision client."""
    global _vision_client, _vision_module

    if _vision_client is not None:
        return _vision_client, _vision_module

    from google.cloud import vision

    _vision_client = vision.ImageAnnotatorClient()
    _vision_module = vision
    return _vision_client, _vision_module


def get_google_translate_client():
    """Return an authenticated Google Cloud Translation client."""
    global _translate_client

    if _translate_client is not None:
        return _translate_client

    from google.cloud import translate_v2 as translate

    _translate_client = translate.Client()
    return _translate_client


def get_hebpipe_package_dir():
    """Return the installed HebPipe package directory without executing its CLI."""
    spec = importlib.util.find_spec("hebpipe")

    if spec is None or not spec.submodule_search_locations:
        raise ImportError("HebPipe is not installed.")

    return Path(next(iter(spec.submodule_search_locations)))


def get_hebpipe_model_path():
    """Return the local HebPipe Hebrew segmentation model path."""
    model_dir = get_hebpipe_package_dir() / "models"
    return model_dir / f"heb.sm{sys.version_info[0]}"


def load_hebpipe_segmentation_runtime():
    """Load only HebPipe segmentation helpers without importing Xrenner/NER."""
    global _hebpipe_runtime

    if _hebpipe_runtime is not None:
        return _hebpipe_runtime

    package_dir = get_hebpipe_package_dir()

    whitespace_path = package_dir / "lib" / "whitespace_tokenize.py"

    def load_module(name, path):
        spec = importlib.util.spec_from_file_location(name, path)
        if spec is None or spec.loader is None:
            raise ImportError(f"Could not load HebPipe module: {path.name}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    whitespace_module = load_module(
        "_hebrew_reader_hebpipe_whitespace",
        whitespace_path,
    )
    from rftokenizer import RFTokenizer

    model_path = get_hebpipe_model_path()
    if not model_path.exists():
        raise FileNotFoundError("HebPipe Hebrew segmentation model is not installed.")

    tokenizer = RFTokenizer(model=str(model_path))

    _hebpipe_runtime = {
        "tokenizer": tokenizer,
        "whitespace_tokenize": whitespace_module.tokenize,
        "abbr_path": str(package_dir / "data" / "heb_abbr.tab"),
    }
    return _hebpipe_runtime


def run_hebrew_segmentation(tokenizer, tokens):
    """Run RFTokenizer with compatibility for the upstream Windows-saved Flair model."""
    with _morphology_lock:
        needs_path_compat = os.name != "nt" and not tokenizer.loaded

        if not needs_path_compat:
            return tokenizer.rf_tokenize(tokens)

        original_windows_path = pathlib.WindowsPath
        pathlib.WindowsPath = pathlib.PosixPath

        try:
            return tokenizer.rf_tokenize(tokens)
        finally:
            pathlib.WindowsPath = original_windows_path


def analyze_hebrew_word(word):
    """Segment one Hebrew word using HebPipe's Hebrew tokenizer resources."""
    clean_word = word.strip()

    if not clean_word:
        return []

    runtime = load_hebpipe_segmentation_runtime()
    tokenized = runtime["whitespace_tokenize"](
        clean_word,
        abbr=runtime["abbr_path"],
        add_sents=False,
        from_pipes=False,
    )
    segmented_lines = run_hebrew_segmentation(
        runtime["tokenizer"],
        tokenized.strip().split("\n"),
    )

    for line in segmented_lines:
        candidate = str(line).strip()
        if candidate and candidate.replace("|", "") == clean_word:
            return [segment for segment in candidate.split("|") if segment]

    return [clean_word]


def check_hebpipe_runtime():
    """Verify that the HebPipe segmentation model can process Hebrew text."""
    model_path = get_hebpipe_model_path()

    if not model_path.exists():
        return {
            "available": False,
            "provider": "hebpipe",
            "reason": "model_missing",
            "missingModels": [model_path.name],
        }

    segments = analyze_hebrew_word("למקום")

    return {
        "available": len(segments) > 1,
        "provider": "hebpipe",
        "reason": None if len(segments) > 1 else "probe_failed",
        "probeWord": "למקום",
        "probeSegments": segments,
    }


class HebrewReaderHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_request_body(self, max_bytes):
        """Read and validate a request body against a strict size limit."""
        content_length = int(self.headers.get("Content-Length", "0"))

        if content_length <= 0 or content_length > max_bytes:
            raise ValueError("Invalid request size.")

        return self.rfile.read(content_length)

    def read_json_payload(self):
        """Read a small UTF-8 JSON request body."""
        return json.loads(
            self.read_request_body(MAX_JSON_REQUEST_BYTES).decode("utf-8")
        )

    def send_cloud_status(self, provider, client_factory, extra=None):
        """Return a consistent availability response for optional Google services."""
        try:
            client_factory()
            payload = {
                "available": True,
                "provider": provider,
            }
            if extra:
                payload.update(extra)
            self.send_json(200, payload)
        except ImportError:
            self.send_json(
                200,
                {
                    "available": False,
                    "provider": provider,
                    "reason": "dependency_missing",
                },
            )
        except Exception as error:
            self.send_json(
                200,
                {
                    "available": False,
                    "provider": provider,
                    "reason": "credentials_missing",
                    "detail": type(error).__name__,
                },
            )

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/tts/status":
            self.send_cloud_status(
                "google",
                get_google_tts_client,
                {"voices": sorted(GOOGLE_HEBREW_VOICES)},
            )
            return

        if path == "/api/translate/status":
            self.send_cloud_status(
                "google-nmt",
                get_google_translate_client,
            )
            return

        if path == "/api/ocr/status":
            self.send_cloud_status(
                "google-vision",
                get_google_vision_client,
            )
            return

        if path == "/api/morphology/status":
            try:
                self.send_json(200, check_hebpipe_runtime())
            except ImportError as error:
                self.send_json(
                    200,
                    {
                        "available": False,
                        "provider": "hebpipe",
                        "reason": "dependency_missing",
                        "detail": str(error),
                    },
                )
            except Exception as error:
                print(f"HebPipe status check failed: {error}")
                self.send_json(
                    200,
                    {
                        "available": False,
                        "provider": "hebpipe",
                        "reason": "runtime_error",
                        "detail": type(error).__name__,
                    },
                )
            return

        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/tts":
            self.handle_tts()
            return

        if path == "/api/ocr":
            self.handle_ocr()
            return

        if path == "/api/translate":
            self.handle_translate()
            return

        if path == "/api/morphology":
            self.handle_morphology()
            return

        self.send_error(404)

    def handle_tts(self):
        try:
            payload = self.read_json_payload()
            text = str(payload.get("text", "")).strip()
            voice_name = str(payload.get("voice", "he-IL-Wavenet-A"))
            speaking_rate = float(payload.get("rate", 1))

            if not text:
                raise ValueError("Text is required.")

            if len(text) > 4_000:
                raise ValueError("Text chunk is too long.")

            if voice_name not in GOOGLE_HEBREW_VOICES:
                raise ValueError("Unsupported Hebrew voice.")

            speaking_rate = min(max(speaking_rate, 0.5), 2.0)

            client, texttospeech = get_google_tts_client()

            response = client.synthesize_speech(
                input=texttospeech.SynthesisInput(text=text),
                voice=texttospeech.VoiceSelectionParams(
                    language_code="he-IL",
                    name=voice_name,
                ),
                audio_config=texttospeech.AudioConfig(
                    audio_encoding=texttospeech.AudioEncoding.MP3,
                    speaking_rate=speaking_rate,
                    pitch=0.0,
                ),
            )

            audio = response.audio_content
            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(audio)
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except ImportError:
            self.send_json(
                503,
                {
                    "error": "Google TTS dependency is not installed.",
                    "code": "dependency_missing",
                },
            )
        except Exception as error:
            print(f"Google TTS failed: {error}")
            self.send_json(
                503,
                {
                    "error": "Google Text-to-Speech is unavailable.",
                    "code": type(error).__name__,
                },
            )

    def handle_ocr(self):
        try:
            content_type = self.headers.get("Content-Type", "")
            if not content_type.startswith("image/"):
                raise ValueError("An image is required.")

            image_bytes = self.read_request_body(MAX_OCR_IMAGE_BYTES)
            client, vision = get_google_vision_client()

            response = client.document_text_detection(
                image=vision.Image(content=image_bytes),
                image_context=vision.ImageContext(language_hints=["he"]),
            )

            if response.error.message:
                raise RuntimeError(response.error.message)

            text = (response.full_text_annotation.text or "").strip()
            self.send_json(
                200,
                {
                    "text": text,
                    "provider": "google-vision",
                },
            )
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except ImportError:
            self.send_json(
                503,
                {
                    "error": "Google Vision dependency is not installed.",
                    "code": "dependency_missing",
                },
            )
        except Exception as error:
            print(f"Google Vision OCR failed: {error}")
            self.send_json(
                503,
                {
                    "error": "Google Vision OCR is unavailable.",
                    "code": type(error).__name__,
                },
            )

    def handle_translate(self):
        try:
            payload = self.read_json_payload()
            text = str(payload.get("text", "")).strip()
            target_language = str(payload.get("target", "")).strip().lower()

            if not text:
                raise ValueError("Text is required.")

            if target_language not in {"en", "ru", "uk"}:
                raise ValueError("Unsupported target language.")

            client = get_google_translate_client()
            result = client.translate(
                text,
                source_language="he",
                target_language=target_language,
                format_="text",
            )

            translated_text = str(result.get("translatedText", "")).strip()
            if not translated_text:
                raise RuntimeError("Google Translation returned no text.")

            self.send_json(
                200,
                {
                    "text": translated_text,
                    "provider": "google-nmt",
                },
            )
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except ImportError:
            self.send_json(
                503,
                {
                    "error": "Google Translation dependency is not installed.",
                    "code": "dependency_missing",
                },
            )
        except Exception as error:
            print(f"Google Translation failed: {error}")
            self.send_json(
                503,
                {
                    "error": "Google Translation is unavailable.",
                    "code": type(error).__name__,
                },
            )

    def handle_morphology(self):
        """Analyze one selected Hebrew word with the local HebPipe model."""
        try:
            payload = self.read_json_payload()
            word = str(payload.get("word", "")).strip()

            if not word:
                raise ValueError("Word is required.")

            if len(word) > 100:
                raise ValueError("Word is too long.")

            segments = analyze_hebrew_word(word)

            self.send_json(
                200,
                {
                    "word": word,
                    "segments": segments,
                    "provider": "hebpipe",
                },
            )
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except ImportError as error:
            self.send_json(
                503,
                {
                    "error": "HebPipe dependency is not installed.",
                    "code": "dependency_missing",
                    "detail": str(error),
                },
            )
        except FileNotFoundError:
            self.send_json(
                503,
                {
                    "error": "HebPipe Hebrew model is not installed.",
                    "code": "model_missing",
                },
            )
        except Exception as error:
            print(f"HebPipe morphology failed: {error}")
            self.send_json(
                503,
                {
                    "error": "Hebrew morphology analysis is unavailable.",
                    "code": type(error).__name__,
                    "detail": str(error),
                },
            )


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), HebrewReaderHandler)
    print(f"Hebrew Reader is running at http://{HOST}:{PORT}")
    print("Google WaveNet, Vision OCR, and Translation use Application Default Credentials when available.")
    print("HebPipe provides local Hebrew morphological analysis.")
    print("Press Control + C to stop.")
    server.serve_forever()
