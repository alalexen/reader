#!/usr/bin/env python3
"""Bootstrap a private PostgreSQL instance for Hebrew Reader.

The managed database lives outside the repository under ~/.hebrew-reader and
binds only to 127.0.0.1. Existing DATABASE_URL configuration is respected, so
the script does not touch a user's work/system PostgreSQL installation.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = PROJECT_ROOT / ".env"
APP_HOME = Path.home() / ".hebrew-reader"
DATA_DIR = APP_HOME / "postgres"
LOG_FILE = APP_HOME / "postgres.log"
MANAGED_CONFIG = APP_HOME / "postgres.json"

DB_NAME = "hebrew_reader"
DB_HOST = "127.0.0.1"
DEFAULT_PORT = 55432
PORT_SCAN_LIMIT = 100


class BootstrapError(RuntimeError):
    """Raised when the managed PostgreSQL bootstrap cannot continue safely."""


def run(
    args: list[str],
    *,
    check: bool = True,
    capture_output: bool = False,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=PROJECT_ROOT,
        check=check,
        text=True,
        capture_output=capture_output,
        env=env,
    )


def postgres_major(binary: Path) -> str | None:
    result = run([str(binary), "--version"], check=False, capture_output=True)
    match = re.search(r"(\d+)(?:\.\d+)?", result.stdout or "")
    return match.group(1) if match else None


def find_postgres_bin_dir(expected_major: str | None = None) -> Path:
    """Find a PostgreSQL installation without changing system services."""
    path_pg_ctl = shutil.which("pg_ctl")
    if path_pg_ctl:
        candidate = Path(path_pg_ctl).resolve().parent
        postgres = candidate / "postgres"
        if postgres.exists():
            major = postgres_major(postgres)
            if expected_major is None or major == expected_major:
                return candidate

    brew = shutil.which("brew")
    if brew:
        formulas: list[str] = []
        if expected_major:
            formulas.append(f"postgresql@{expected_major}")
        formulas.extend(["postgresql@17", "postgresql@16", "postgresql@15", "postgresql"])

        seen: set[str] = set()
        for formula in formulas:
            if formula in seen:
                continue
            seen.add(formula)
            result = run(
                [brew, "--prefix", formula],
                check=False,
                capture_output=True,
            )
            if result.returncode != 0:
                continue

            candidate = Path(result.stdout.strip()) / "bin"
            postgres = candidate / "postgres"
            if not postgres.exists():
                continue

            major = postgres_major(postgres)
            if expected_major is None or major == expected_major:
                return candidate

    hint = (
        "PostgreSQL command-line tools were not found. "
        "On macOS install them with: brew install postgresql@15"
    )
    if expected_major:
        hint += f" (the existing Hebrew Reader cluster requires PostgreSQL {expected_major})"
    raise BootstrapError(hint)


def load_database_url() -> str | None:
    value = os.environ.get("DATABASE_URL", "").strip()
    if value:
        return value

    if ENV_FILE.exists():
        value = str(dotenv_values(ENV_FILE).get("DATABASE_URL") or "").strip()
        if value:
            return value

    return None


def local_managed_port(database_url: str | None) -> int | None:
    """Infer the managed port only for our own local cluster."""
    if not database_url or not (DATA_DIR / "PG_VERSION").exists():
        return None

    try:
        url = make_url(database_url)
    except Exception:
        return None

    if url.get_backend_name() != "postgresql":
        return None
    if url.database != DB_NAME:
        return None
    if url.host not in {"localhost", "127.0.0.1"}:
        return None

    port = url.port or 5432
    if not (DEFAULT_PORT <= port < DEFAULT_PORT + PORT_SCAN_LIMIT):
        return None
    return port


def database_url_matches_managed(
    database_url: str | None,
    config: dict | None,
) -> bool:
    port = local_managed_port(database_url)
    if port is None:
        return False
    if config is None:
        return True
    return port == int(config["port"])


def read_managed_config() -> dict | None:
    if not MANAGED_CONFIG.exists():
        return None
    try:
        payload = json.loads(MANAGED_CONFIG.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None

    if not isinstance(payload, dict):
        return None
    if not isinstance(payload.get("port"), int):
        return None
    return payload


def write_managed_config(port: int) -> None:
    APP_HOME.mkdir(parents=True, exist_ok=True)
    MANAGED_CONFIG.write_text(
        json.dumps(
            {
                "host": DB_HOST,
                "port": port,
                "database": DB_NAME,
                "data_dir": str(DATA_DIR),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def write_env(database_url: str) -> None:
    """Create .env only when the project does not already have one."""
    if ENV_FILE.exists():
        return

    ENV_FILE.write_text(
        "# Created by scripts/bootstrap_db.py\n"
        "# This file is local and is ignored by Git.\n"
        f"DATABASE_URL={database_url}\n",
        encoding="utf-8",
    )


def port_is_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((DB_HOST, port))
        except OSError:
            return False
    return True


def choose_free_port() -> int:
    for port in range(DEFAULT_PORT, DEFAULT_PORT + PORT_SCAN_LIMIT):
        if port_is_free(port):
            return port
    raise BootstrapError(
        f"No free local port was found in {DEFAULT_PORT}-"
        f"{DEFAULT_PORT + PORT_SCAN_LIMIT - 1}."
    )


def cluster_is_running(pg_ctl: Path) -> bool:
    result = run(
        [str(pg_ctl), "status", "-D", str(DATA_DIR)],
        check=False,
        capture_output=True,
    )
    return result.returncode == 0


def initialize_cluster(bin_dir: Path) -> None:
    if (DATA_DIR / "PG_VERSION").exists():
        return

    if DATA_DIR.exists() and any(DATA_DIR.iterdir()):
        raise BootstrapError(
            f"{DATA_DIR} exists but is not a PostgreSQL data directory. "
            "Move or remove that directory manually before retrying."
        )

    APP_HOME.mkdir(parents=True, exist_ok=True)
    initdb = bin_dir / "initdb"

    print(f"Initializing private PostgreSQL cluster in {DATA_DIR} ...")
    run(
        [
            str(initdb),
            "-D",
            str(DATA_DIR),
            "--encoding=UTF8",
            "--auth-local=trust",
            "--auth-host=trust",
        ]
    )


def start_cluster(bin_dir: Path, port: int) -> None:
    pg_ctl = bin_dir / "pg_ctl"

    if cluster_is_running(pg_ctl):
        print(f"Hebrew Reader PostgreSQL is already running on port {port}.")
        return

    if not port_is_free(port):
        raise BootstrapError(
            f"Port {port} is already in use by another process. "
            "Hebrew Reader will not stop or modify that process."
        )

    APP_HOME.mkdir(parents=True, exist_ok=True)

    print(f"Starting private PostgreSQL on {DB_HOST}:{port} ...")
    run(
        [
            str(pg_ctl),
            "start",
            "-D",
            str(DATA_DIR),
            "-l",
            str(LOG_FILE),
            "-o",
            f"-h {DB_HOST} -p {port}",
            "-w",
        ]
    )


def database_exists(bin_dir: Path, port: int) -> bool:
    psql = bin_dir / "psql"
    result = run(
        [
            str(psql),
            "-h",
            DB_HOST,
            "-p",
            str(port),
            "-d",
            "postgres",
            "-tAc",
            f"SELECT 1 FROM pg_database WHERE datname = '{DB_NAME}'",
        ],
        check=False,
        capture_output=True,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise BootstrapError(
            "Could not query the managed PostgreSQL server."
            + (f"\n{detail}" if detail else "")
        )
    return result.stdout.strip() == "1"


def ensure_database(bin_dir: Path, port: int) -> None:
    if database_exists(bin_dir, port):
        return

    print(f"Creating database {DB_NAME} ...")
    run(
        [
            str(bin_dir / "createdb"),
            "-h",
            DB_HOST,
            "-p",
            str(port),
            DB_NAME,
        ]
    )


def apply_migrations(database_url: str) -> None:
    print("Applying database migrations ...")
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    run([sys.executable, "scripts/init_db.py"], env=env)


def seed_demo(database_url: str) -> None:
    print("Adding optional demo data ...")
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    run([sys.executable, "scripts/seed_demo.py"], env=env)


def bootstrap_managed_database(*, demo: bool = False) -> str:
    """Ensure the private Hebrew Reader PostgreSQL cluster is ready."""
    existing_url = load_database_url()
    config = read_managed_config()

    inferred_port = local_managed_port(existing_url)
    if config is None and inferred_port is not None:
        # This covers early installations created before postgres.json existed.
        write_managed_config(inferred_port)
        config = read_managed_config()

    if existing_url and not database_url_matches_managed(existing_url, config):
        print("Using existing DATABASE_URL configuration.")
        print("No PostgreSQL service or data directory will be modified.")
        apply_migrations(existing_url)
        if demo:
            seed_demo(existing_url)
        return existing_url

    expected_major = None
    pg_version_file = DATA_DIR / "PG_VERSION"
    if pg_version_file.exists():
        expected_major = pg_version_file.read_text(encoding="utf-8").strip()

    bin_dir = find_postgres_bin_dir(expected_major)

    if not pg_version_file.exists():
        initialize_cluster(bin_dir)

    if config is not None:
        port = int(config["port"])
    elif inferred_port is not None:
        port = inferred_port
    else:
        port = choose_free_port()

    write_managed_config(port)
    start_cluster(bin_dir, port)
    ensure_database(bin_dir, port)

    database_url = (
        existing_url
        or f"postgresql+psycopg://{DB_HOST}:{port}/{DB_NAME}"
    )
    write_env(database_url)

    apply_migrations(database_url)
    if demo:
        seed_demo(database_url)

    print()
    print("Database ready.")
    print(f"Data directory: {DATA_DIR}")
    print(f"Connection: {DB_HOST}:{port}/{DB_NAME}")
    return database_url


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prepare Hebrew Reader's private PostgreSQL database."
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Seed the empty database with optional demo learning data.",
    )
    args = parser.parse_args()

    try:
        bootstrap_managed_database(demo=args.demo)
    except BootstrapError as error:
        raise SystemExit(f"Database setup failed: {error}") from error


if __name__ == "__main__":
    main()
