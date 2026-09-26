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

def package_dir(name):
    spec = importlib.util.find_spec(name)
    if spec is None or not spec.submodule_search_locations:
        raise SystemExit(f"{name} package was not found after installation.")
    return Path(next(iter(spec.submodule_search_locations)))

hebpipe_dir = package_dir("hebpipe")
rftokenizer_dir = package_dir("rftokenizer")

downloads = [
    (
        hebpipe_dir / "models" / "heb.sm3",
        "https://gucorpling.org/amir/download/heb_models_v4/heb.sm3",
        "HebPipe segmentation model",
    ),
    (
        rftokenizer_dir / "models" / "heb.seg",
        "https://gucorpling.org/amir/download/heb_models_v4/heb.seg",
        "Hebrew Flair segmentation model",
    ),
]

for target, url, label in downloads:
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists():
        print(f"Downloading {label}...")
        urlretrieve(url, target)
    print(f"{label}: {target}")
"""
    run(python, "-c", model_setup)

    probe = r"""
import sklearn
import pandas
import flair
from server import analyze_hebrew_word

if sklearn.__version__ != "1.4.1.post1":
    raise SystemExit(f"Unexpected scikit-learn version: {sklearn.__version__}")

if pandas.__version__ != "2.1.2":
    raise SystemExit(f"Unexpected Pandas version: {pandas.__version__}")

if flair.__version__ != "0.13.0":
    raise SystemExit(f"Unexpected Flair version: {flair.__version__}")

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
