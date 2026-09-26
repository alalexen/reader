#!/usr/bin/env python3
"""Prepare Hebrew Reader's database and start the local web server."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from bootstrap_db import BootstrapError, bootstrap_managed_database


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Start Hebrew Reader with its PostgreSQL database ready."
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Add optional demo data before starting the app.",
    )
    args = parser.parse_args()

    try:
        database_url = bootstrap_managed_database(demo=args.demo)
    except BootstrapError as error:
        raise SystemExit(f"Startup failed: {error}") from error

    env = os.environ.copy()
    env["DATABASE_URL"] = database_url

    print()
    print("Starting Hebrew Reader at http://127.0.0.1:8000")
    print("Press Control + C to stop the web server.")
    print()

    os.chdir(PROJECT_ROOT)
    os.execve(
        sys.executable,
        [sys.executable, str(PROJECT_ROOT / "server.py")],
        env,
    )


if __name__ == "__main__":
    main()
