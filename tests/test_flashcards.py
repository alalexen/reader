"""Unit tests for flashcard import validation (no PostgreSQL required)."""

import unittest
from datetime import datetime, timezone

from backend.flashcards import validate_card


class FlashcardValidationTests(unittest.TestCase):
    def test_valid_card_preserves_trilingual_translations(self):
        actual = validate_card({
            "word": " שלום ",
            "sentence": "שלום עולם.",
            "translations": {"en": "hello", "ru": "привет", "uk": "привіт"},
            "example": "legacy ignored field",
        })
        self.assertEqual(actual["word"], "שלום")
        self.assertEqual(actual["translations"]["uk"], "привіт")
        self.assertEqual(actual["sentence"], "שלום עולם.")

    def test_rejects_non_string_word(self):
        with self.assertRaises(ValueError):
            validate_card({"word": 123})

    def test_rejects_missing_word(self):
        with self.assertRaises(ValueError):
            validate_card({"translations": {}})

    def test_rejects_bad_translations(self):
        with self.assertRaises(ValueError):
            validate_card({"word": "ספר", "translations": {"en": ["book"]}})

    def test_legacy_timestamp_is_preserved(self):
        card = validate_card({
            "word": "ספר",
            "savedAt": "2026-10-04T13:20:00.000Z",
        })
        self.assertEqual(
            card["saved_at"],
            datetime(2026, 10, 4, 13, 20, tzinfo=timezone.utc),
        )

    def test_invalid_legacy_timestamp_is_ignored(self):
        card = validate_card({"word": "ספר", "savedAt": "not a date"})
        self.assertIsNone(card["saved_at"])

    def test_empty_optional_fields(self):
        actual = validate_card({"word": "ספר"})
        self.assertEqual(actual["sentence"], "")
        self.assertEqual(actual["translations"], {"en": "", "ru": "", "uk": ""})


if __name__ == "__main__":
    unittest.main()
