#!/usr/bin/env python3
"""Local development server for Hebrew Reader, including optional Google Cloud services."""

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
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
_hebrew_tokenizer = None


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


def get_hebrew_tokenizer():
    """Return the lazily initialized local RFTokenizer Hebrew model."""
    global _hebrew_tokenizer

    if _hebrew_tokenizer is not None:
        return _hebrew_tokenizer

    from rftokenizer import RFTokenizer

    _hebrew_tokenizer = RFTokenizer(model="heb")
    return _hebrew_tokenizer


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
                get_hebrew_tokenizer()
                self.send_json(
                    200,
                    {
                        "available": True,
                        "provider": "rftokenizer",
                    },
                )
            except ImportError:
                self.send_json(
                    200,
                    {
                        "available": False,
                        "provider": "rftokenizer",
                        "reason": "dependency_missing",
                    },
                )
            except Exception as error:
                self.send_json(
                    200,
                    {
                        "available": False,
                        "provider": "rftokenizer",
                        "reason": "model_unavailable",
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
        """Segment one Hebrew word with the local RFTokenizer model."""
        try:
            payload = self.read_json_payload()
            word = str(payload.get("word", "")).strip()

            if not word:
                raise ValueError("Word is required.")

            if len(word) > 100:
                raise ValueError("Word is too long.")

            tokenizer = get_hebrew_tokenizer()
            analyses = tokenizer.rf_tokenize([word])

            if not analyses:
                raise RuntimeError("RFTokenizer returned no analysis.")

            segmented = str(analyses[0]).strip()
            segments = [segment for segment in segmented.split("|") if segment]

            self.send_json(
                200,
                {
                    "word": word,
                    "segments": segments,
                    "provider": "rftokenizer",
                },
            )
        except ValueError as error:
            self.send_json(400, {"error": str(error)})
        except ImportError:
            self.send_json(
                503,
                {
                    "error": "RFTokenizer dependency is not installed.",
                    "code": "dependency_missing",
                },
            )
        except Exception as error:
            print(f"RFTokenizer morphology failed: {error}")
            self.send_json(
                503,
                {
                    "error": "Hebrew morphology analysis is unavailable.",
                    "code": type(error).__name__,
                },
            )


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), HebrewReaderHandler)
    print(f"Hebrew Reader is running at http://{HOST}:{PORT}")
    print("Google WaveNet, Vision OCR, and Translation use Application Default Credentials when available.")
    print("RFTokenizer provides local Hebrew morphological segmentation.")
    print("Press Control + C to stop.")
    server.serve_forever()
