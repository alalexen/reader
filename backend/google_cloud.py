"""Lazy Google Cloud client factories used by the local API server."""

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
