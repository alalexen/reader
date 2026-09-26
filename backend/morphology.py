"""Local Hebrew morphological segmentation powered by HebPipe resources."""

import importlib.util
import os
import pathlib
import sys
import threading
from pathlib import Path

_hebpipe_runtime = None
_morphology_lock = threading.Lock()


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
