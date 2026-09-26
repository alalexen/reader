#!/usr/bin/env python3
"""Apply all PostgreSQL migrations for Hebrew Reader."""

from __future__ import annotations

import sys
from pathlib import Path

from alembic import command
from alembic.config import Config

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))


def main() -> None:
    config = Config(str(PROJECT_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(PROJECT_ROOT / "migrations"))
    command.upgrade(config, "head")
    print("Database schema is up to date.")


if __name__ == "__main__":
    main()
