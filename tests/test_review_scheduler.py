"""Deterministic SRS scheduling tests without a database."""

import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from backend.review_scheduler import schedule_review


class ReviewSchedulerTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 10, tzinfo=timezone.utc)
        self.card = SimpleNamespace(
            interval_days=0, review_count=0, lapse_count=0,
            next_review_at=None, last_reviewed_at=None, state="new",
        )

    def test_first_good_is_due_tomorrow(self):
        previous, interval = schedule_review(self.card, "good", self.now)
        self.assertEqual(previous, 0)
        self.assertEqual(interval, 1)
        self.assertEqual(self.card.review_count, 1)
        self.assertEqual(self.card.state, "review")
        self.assertEqual(self.card.next_review_at.day, 11)

    def test_again_is_due_in_ten_minutes(self):
        _, interval = schedule_review(self.card, "again", self.now)
        self.assertAlmostEqual(interval * 1440, 10)
        self.assertEqual(self.card.lapse_count, 1)
        self.assertEqual(self.card.next_review_at.minute, 10)

    def test_easy_grows_faster_than_hard(self):
        self.card.interval_days = 3
        _, hard = schedule_review(self.card, "hard", self.now)
        self.card.interval_days = 3
        _, easy = schedule_review(self.card, "easy", self.now)
        self.assertGreater(easy, hard)

    def test_invalid_rating_never_mutates_card(self):
        with self.assertRaises(ValueError):
            schedule_review(self.card, "invalid", self.now)
        self.assertEqual(self.card.review_count, 0)


if __name__ == "__main__":
    unittest.main()
