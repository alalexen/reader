"""Schema-level tests that do not require a running PostgreSQL server."""

import unittest

from backend.database import Base
from backend import models  # noqa: F401


class DatabaseSchemaTests(unittest.TestCase):
    def test_expected_tables_are_registered(self):
        self.assertEqual(
            set(Base.metadata.tables),
            {
                "texts",
                "words",
                "encounters",
                "cards",
                "review_events",
                "study_sessions",
            },
        )

    def test_words_have_unique_normalized_form(self):
        table = Base.metadata.tables["words"]
        unique_names = {
            constraint.name
            for constraint in table.constraints
            if constraint.name
        }
        self.assertIn("uq_words_normalized", unique_names)

    def test_review_schedule_is_indexed(self):
        table = Base.metadata.tables["cards"]
        index_names = {index.name for index in table.indexes}
        self.assertIn("ix_cards_next_review_at", index_names)


if __name__ == "__main__":
    unittest.main()
