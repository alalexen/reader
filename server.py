#!/usr/bin/env python3
"""Local development server for Hebrew Reader, including optional Google Cloud services."""

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = 8000
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


class HebrewReaderHandler(SimpleHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/tts/status":
            try:
                get_google_tts_client()
                self.send_json(
                    200,
                    {
                        "available": True,
                        "provider": "google",
                        "voices": sorted(GOOGLE_HEBREW_VOICES),
                    },
                )
            except ImportError:
                self.send_json(
                    200,
                    {
                        "available": False,
                        "provider": "google",
                        "reason": "dependency_missing",
                    },
                )
            except Exception as error:
                self.send_json(
                    200,
                    {
                        "available": False,
                        "provider": "google",
                        "reason": "credentials_missing",
                        "detail": type(error).__name__,
                    },
                )
            return

        if path == "/api/ocr/status":
            try:
                get_google_vision_client()
                self.send_json(
                    200,
                    {
                        "available": True,
                        "provider": "google-vision",
                    },
                )
            except ImportError:
                self.send_json(
                    200,
                    {
                        "available": False,
                        "provider": "google-vision",
                        "reason": "dependency_missing",
                    },
                )
            except Exception as error:
                self.send_json(
                    200,
                    {
                        "available": False,
                        "provider": "google-vision",
                        "reason": "credentials_missing",
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

        self.send_error(404)

    def handle_tts(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 64_000:
                raise ValueError("Invalid request size.")

            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
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
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > MAX_OCR_IMAGE_BYTES:
                raise ValueError("Invalid image size.")

            content_type = self.headers.get("Content-Type", "")
            if not content_type.startswith("image/"):
                raise ValueError("An image is required.")

            image_bytes = self.rfile.read(content_length)
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


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), HebrewReaderHandler)
    print(f"Hebrew Reader is running at http://{HOST}:{PORT}")
    print("Google WaveNet and Vision OCR are used when Application Default Credentials are available.")
    print("Press Control + C to stop.")
    server.serve_forever()
