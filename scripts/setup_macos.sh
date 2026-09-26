#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if ! command -v python3.12 >/dev/null 2>&1; then
  echo "Python 3.12 is required."
  echo "Install it with: brew install python@3.12"
  exit 1
fi

echo "Recreating .venv with Python 3.12..."
rm -rf .venv
python3.12 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt

# HebPipe is installed without its full dependency stack because Hebrew Reader
# only uses HebPipe's tokenizer resources and Hebrew segmentation model.
python -m pip install "hebpipe==4.0.2.0" --no-deps

echo
echo "Downloading the pretrained HebPipe Hebrew segmentation model if needed..."
python - <<'PY'
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
    urlretrieve(
        "https://gucorpling.org/amir/download/heb_models_v4/heb.sm3",
        model_path,
    )

print(f"HebPipe model: {model_path}")
PY

echo
echo "Verifying local Hebrew morphology..."
python - <<'PY'
from server import analyze_hebrew_word

segments = analyze_hebrew_word("למקום")
if len(segments) < 2:
    raise SystemExit(f"Morphology probe failed: {segments}")

print("Morphology probe:", "|".join(segments))
PY

echo
echo "Setup complete."
echo "Start the app with:"
echo "  source .venv/bin/activate"
echo "  python server.py"
