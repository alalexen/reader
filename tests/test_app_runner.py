"""Tests for the Hebrew Reader launcher without terminating real processes."""

from __future__ import annotations

import unittest
from unittest.mock import call, patch

from scripts import run_hebrew_reader


class HebrewReaderRunnerTests(unittest.TestCase):
    def test_clear_web_port_does_nothing_when_free(self):
        with (
            patch.object(run_hebrew_reader, "port_is_free", return_value=True),
            patch.object(run_hebrew_reader, "listening_pids") as listening,
            patch.object(run_hebrew_reader, "terminate_process") as terminate,
        ):
            run_hebrew_reader.clear_web_port(8000)

        listening.assert_not_called()
        terminate.assert_not_called()

    def test_clear_web_port_gracefully_stops_existing_listener(self):
        with (
            patch.object(run_hebrew_reader, "port_is_free", return_value=False),
            patch.object(run_hebrew_reader, "listening_pids", return_value=[1234]),
            patch.object(
                run_hebrew_reader,
                "process_label",
                return_value="python server.py",
            ),
            patch.object(run_hebrew_reader, "terminate_process") as terminate,
            patch.object(
                run_hebrew_reader,
                "wait_until_port_free",
                return_value=True,
            ),
        ):
            run_hebrew_reader.clear_web_port(8000)

        terminate.assert_called_once_with(1234)

    def test_clear_web_port_force_stops_when_graceful_stop_fails(self):
        with (
            patch.object(run_hebrew_reader, "port_is_free", return_value=False),
            patch.object(
                run_hebrew_reader,
                "listening_pids",
                side_effect=[[1234], [1234]],
            ),
            patch.object(
                run_hebrew_reader,
                "process_label",
                return_value="python server.py",
            ),
            patch.object(run_hebrew_reader, "terminate_process") as terminate,
            patch.object(
                run_hebrew_reader,
                "wait_until_port_free",
                side_effect=[False, True],
            ),
        ):
            run_hebrew_reader.clear_web_port(8000)

        self.assertEqual(
            terminate.call_args_list,
            [
                call(1234),
                call(1234, force=True),
            ],
        )


if __name__ == "__main__":
    unittest.main()
