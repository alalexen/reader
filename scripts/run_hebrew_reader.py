#!/usr/bin/env python3
"""Prepare Hebrew Reader and run its local web server.

This is the main command for day-to-day use. It prepares PostgreSQL, makes
sure the fixed web port is available, and then launches server.py.
"""

from __future__ import annotations

import argparse
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from bootstrap_db import BootstrapError, bootstrap_managed_database

WEB_HOST = "127.0.0.1"
WEB_PORT = 8000
GRACEFUL_STOP_SECONDS = 3.0
FORCE_STOP_SECONDS = 2.0


class RunnerError(RuntimeError):
    """Raised when Hebrew Reader cannot safely prepare its web server."""


def port_is_free(port: int = WEB_PORT) -> bool:
    """Return True when the local web server can bind the requested port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind((WEB_HOST, port))
        except OSError:
            return False
    return True


def _posix_listening_pids(port: int) -> list[int]:
    lsof = shutil_which("lsof")
    if not lsof:
        if port_is_free(port):
            return []
        raise RunnerError(
            f"Port {port} is busy, but 'lsof' is unavailable so the owning "
            "process cannot be identified."
        )

    result = subprocess.run(
        [lsof, "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode not in {0, 1}:
        detail = (result.stderr or "").strip()
        raise RunnerError(
            f"Could not inspect port {port}."
            + (f" {detail}" if detail else "")
        )

    pids: set[int] = set()
    for line in result.stdout.splitlines():
        value = line.strip()
        if value.isdigit():
            pids.add(int(value))
    return sorted(pids)


def _windows_listening_pids(port: int) -> list[int]:
    result = subprocess.run(
        ["netstat", "-ano", "-p", "tcp"],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RunnerError(f"Could not inspect port {port} with netstat.")

    pids: set[int] = set()
    suffix = f":{port}"

    for line in result.stdout.splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue

        local_address = parts[1]
        state = parts[3].upper()
        pid = parts[4]

        if state == "LISTENING" and local_address.endswith(suffix) and pid.isdigit():
            pids.add(int(pid))

    return sorted(pids)


def listening_pids(port: int = WEB_PORT) -> list[int]:
    if os.name == "nt":
        return _windows_listening_pids(port)
    return _posix_listening_pids(port)


def shutil_which(command: str) -> str | None:
    """Small local wrapper to keep process lookup easy to mock in tests."""
    import shutil

    return shutil.which(command)


def process_label(pid: int) -> str:
    """Return a best-effort command label for transparent shutdown logging."""
    if os.name == "nt":
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
            cwd=PROJECT_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        label = result.stdout.strip()
        return label if label else "unknown process"

    result = subprocess.run(
        ["ps", "-p", str(pid), "-o", "command="],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    label = result.stdout.strip()
    return label if label else "unknown process"


def terminate_process(pid: int, *, force: bool = False) -> None:
    if pid == os.getpid():
        raise RunnerError("Refusing to terminate the current launcher process.")

    if os.name == "nt":
        command = ["taskkill", "/PID", str(pid), "/T"]
        if force:
            command.append("/F")
        result = subprocess.run(
            command,
            cwd=PROJECT_ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        if (
            force
            and result.returncode != 0
            and pid in listening_pids(WEB_PORT)
        ):
            detail = (result.stderr or result.stdout or "").strip()
            raise RunnerError(
                f"Could not stop PID {pid}."
                + (f" {detail}" if detail else "")
            )
        return

    sig = signal.SIGKILL if force else signal.SIGTERM
    try:
        os.kill(pid, sig)
    except ProcessLookupError:
        return
    except PermissionError as error:
        raise RunnerError(
            f"Permission denied while stopping PID {pid} ({process_label(pid)})."
        ) from error


def wait_until_port_free(port: int, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if port_is_free(port):
            return True
        time.sleep(0.1)
    return port_is_free(port)


def clear_web_port(port: int = WEB_PORT) -> None:
    """Stop current listeners so Hebrew Reader can keep its stable localhost URL."""
    if port_is_free(port):
        return

    pids = listening_pids(port)

    if not pids:
        raise RunnerError(
            f"Port {port} is occupied, but no listening process could be identified."
        )

    print(f"Port {port} is already in use.")
    for pid in pids:
        print(f"Stopping PID {pid}: {process_label(pid)}")
        terminate_process(pid)

    if wait_until_port_free(port, GRACEFUL_STOP_SECONDS):
        print(f"Port {port} is free.")
        return

    remaining = listening_pids(port)
    if remaining:
        print(
            f"Port {port} did not close after a graceful stop; "
            "forcing the remaining listener(s) to exit."
        )
        for pid in remaining:
            print(f"Force-stopping PID {pid}: {process_label(pid)}")
            terminate_process(pid, force=True)

    if not wait_until_port_free(port, FORCE_STOP_SECONDS):
        raise RunnerError(
            f"Port {port} is still busy after stopping its listener process(es)."
        )

    print(f"Port {port} is free.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Prepare Hebrew Reader's PostgreSQL database and run the local app."
        )
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Add optional demo data before starting the app.",
    )
    args = parser.parse_args()

    try:
        database_url = bootstrap_managed_database(demo=args.demo)
        clear_web_port(WEB_PORT)
    except (BootstrapError, RunnerError) as error:
        raise SystemExit(f"Hebrew Reader startup failed: {error}") from error

    env = os.environ.copy()
    env["DATABASE_URL"] = database_url

    print()
    print(f"Starting Hebrew Reader at http://{WEB_HOST}:{WEB_PORT}")
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
