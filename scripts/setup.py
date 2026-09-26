#!/usr/bin/env python3
"""Create a reproducible local Python environment for Hebrew Reader."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import venv
from pathlib import Path

REQUIRED_PYTHON = (3, 12)
HEBPIPE_VERSION = "4.0.2.0"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
VENV_DIR = PROJECT_ROOT / ".venv"


def run(*args: str) -> None:
    subprocess.run(args, cwd=PROJECT_ROOT, check=True)


def get_venv_python() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def main() -> None:
    if sys.version_info[:2] != REQUIRED_PYTHON:
        version = ".".join(map(str, sys.version_info[:3]))
        raise SystemExit(
            f"Python 3.12 is required. This interpreter is Python {version}."
        )

    if VENV_DIR.exists():
        shutil.rmtree(VENV_DIR)

    print("Creating .venv with Python 3.12...")
    venv.EnvBuilder(with_pip=True).create(VENV_DIR)

    python = str(get_venv_python())

    run(python, "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel")
    run(python, "-m", "pip", "install", "-r", "requirements.txt")

    # Hebrew Reader uses HebPipe's tokenizer resources and pretrained Hebrew
    # segmentation model, not HebPipe's full NLP dependency stack.
    run(
        python,
        "-m",
        "pip",
        "install",
        f"hebpipe=={HEBPIPE_VERSION}",
        "--no-deps",
    )

    model_setup = r"""
import importlib.util
from pathlib import Path
from urllib.request import urlretrieve

spec = importlib.util.find_spec("hebpipe")
if spec is None or not spec.submodule_search_locations:
    raise SystemExit("HebPipe package was not found after installation.")

package_dir = Path(next(iter(spec.submodule_search_locations)))
model_dir = package_dir / "models"
model_dir.mkdir(parents=True, exist_ok=True)
model_path = model_dir / "heb.sm3"

if not model_path.exists():
    print("Downloading pretrained Hebrew segmentation model...")
    urlretrieve(
        "https://gucorpling.org/amir/download/heb_models_v4/heb.sm3",
        model_path,
    )

print(f"HebPipe model: {model_path}")
"""
    run(python, "-c", model_setup)

    probe = r"""
from server import analyze_hebrew_word

segments = analyze_hebrew_word("למקום")
if len(segments) < 2:
    raise SystemExit(f"Morphology probe failed: {segments}")

print("Morphology probe:", "|".join(segments))
"""
    run(python, "-c", probe)

    print()
    print("Setup complete.")
    print("Start the app with:")
    if os.name == "nt":
        print(r"  .venv\Scripts\activate")
    else:
        print("  source .venv/bin/activate")
    print("  python server.py")


if __name__ == "__main__":
    main()
