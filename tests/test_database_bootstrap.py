"""Tests for PostgreSQL bootstrap decisions that do not start a server."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import bootstrap_db


class DatabaseBootstrapTests(unittest.TestCase):
    def test_managed_url_is_detected_for_existing_cluster(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            (data_dir / "PG_VERSION").write_text("15\n", encoding="utf-8")

            with patch.object(bootstrap_db, "DATA_DIR", data_dir):
                port = bootstrap_db.local_managed_port(
                    "postgresql+psycopg://127.0.0.1:55432/hebrew_reader"
                )

            self.assertEqual(port, 55432)

    def test_remote_database_is_never_treated_as_managed(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            (data_dir / "PG_VERSION").write_text("15\n", encoding="utf-8")

            with patch.object(bootstrap_db, "DATA_DIR", data_dir):
                port = bootstrap_db.local_managed_port(
                    "postgresql+psycopg://db.example.com:5432/hebrew_reader"
                )

            self.assertIsNone(port)

    def test_different_database_name_is_not_managed(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir)
            (data_dir / "PG_VERSION").write_text("15\n", encoding="utf-8")

            with patch.object(bootstrap_db, "DATA_DIR", data_dir):
                port = bootstrap_db.local_managed_port(
                    "postgresql+psycopg://127.0.0.1:55432/company_database"
                )

            self.assertIsNone(port)


if __name__ == "__main__":
    unittest.main()
