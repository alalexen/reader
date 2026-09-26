#!/usr/bin/env python3
"""Stop Hebrew Reader's managed PostgreSQL cluster, if it is running."""

from __future__ import annotations

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from bootstrap_db import BootstrapError, DATA_DIR, find_postgres_bin_dir, run


def main() -> None:
    if not (DATA_DIR / "PG_VERSION").exists():
        print("No managed Hebrew Reader PostgreSQL cluster was found.")
        return

    expected_major = (DATA_DIR / "PG_VERSION").read_text(encoding="utf-8").strip()
    bin_dir = find_postgres_bin_dir(expected_major)
    pg_ctl = bin_dir / "pg_ctl"

    status = run(
        [str(pg_ctl), "status", "-D", str(DATA_DIR)],
        check=False,
        capture_output=True,
    )
    if status.returncode != 0:
        print("Hebrew Reader PostgreSQL is already stopped.")
        return

    print("Stopping Hebrew Reader PostgreSQL ...")
    run(
        [
            str(pg_ctl),
            "stop",
            "-D",
            str(DATA_DIR),
            "-m",
            "fast",
            "-w",
        ]
    )
    print("Hebrew Reader PostgreSQL stopped.")


if __name__ == "__main__":
    try:
        main()
    except BootstrapError as error:
        raise SystemExit(f"Could not stop database: {error}") from error
