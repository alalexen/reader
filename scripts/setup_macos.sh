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

# HebPipe's own Dockerfiles install DiaParser without dependencies because
# DiaParser's published stanza pin conflicts with HebPipe's stanza version.
python -m pip install "diaparser==1.1.3" --no-deps

# All HebPipe runtime dependencies are already installed above, so skip
# dependency resolution here to avoid the upstream stanza/DiaParser conflict.
python -m pip install "hebpipe==4.0.2.0" --no-deps

echo
echo "Downloading Stanza Hebrew resources if they are missing..."
python - <<'PY'
import stanza
stanza.download("he")
PY

echo
echo "Installed Python:"
python --version
echo
echo "HebPipe package:"
python -m pip show hebpipe | sed -n '1,6p'

HEBPIPE_DIR="$(python - <<'PY'
import importlib.util
spec = importlib.util.find_spec("hebpipe")
if spec is None or not spec.submodule_search_locations:
    raise SystemExit("HebPipe package was not found after installation.")
print(next(iter(spec.submodule_search_locations)))
PY
)"

HEBPIPE_SCRIPT="$HEBPIPE_DIR/heb_pipe.py"
TMP_INPUT="$(mktemp)"
printf 'למקום\n' > "$TMP_INPUT"

echo
echo "Downloading HebPipe pretrained Hebrew models if they are missing..."
printf 'Y\n' | python "$HEBPIPE_SCRIPT" -wt -o pipes --cpu "$TMP_INPUT"
rm -f "$TMP_INPUT"

echo
echo "Setup complete."
echo "Start the app with:"
echo "  source .venv/bin/activate"
echo "  python server.py"
