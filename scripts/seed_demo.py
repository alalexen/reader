#!/usr/bin/env python3
"""Insert small, safe demo data into an initialized Hebrew Reader database."""

from __future__ import annotations

from backend.database import session_scope
from backend.models import Card
from backend.repositories.learning_repository import (
    create_card,
    create_text,
    create_word,
    get_text_by_title,
    get_word_by_normalized,
)

DEMO_TITLE = "Demo: Hebrew reading practice"
DEMO_TEXT = "אני לומד עברית כל יום. אני קורא ספר ושומע עברית."


def main() -> None:
    created = []

    with session_scope() as session:
        text = get_text_by_title(session, DEMO_TITLE)
        if text is None:
            text = create_text(
                session,
                title=DEMO_TITLE,
                kind="pasted",
                original_text=DEMO_TEXT,
            )
            created.append("text")

        demo_words = [
            {
                "surface": "לומד",
                "normalized": "לומד",
                "sentence": "אני לומד עברית כל יום.",
                "translations": {
                    "en": "learn / study",
                    "ru": "учусь / изучаю",
                    "uk": "вчуся / вивчаю",
                },
            },
            {
                "surface": "קורא",
                "normalized": "קורא",
                "sentence": "אני קורא ספר ושומע עברית.",
                "translations": {
                    "en": "read",
                    "ru": "читаю",
                    "uk": "читаю",
                },
            },
            {
                "surface": "שומע",
                "normalized": "שומע",
                "sentence": "אני קורא ספר ושומע עברית.",
                "translations": {
                    "en": "hear / listen",
                    "ru": "слышу / слушаю",
                    "uk": "чую / слухаю",
                },
            },
        ]

        for item in demo_words:
            word = get_word_by_normalized(session, item["normalized"])
            if word is None:
                word = create_word(
                    session,
                    surface=item["surface"],
                    normalized=item["normalized"],
                    status="learning",
                )
                created.append(f"word:{item['normalized']}")

            existing_card = next(
                (
                    card
                    for card in word.cards
                    if card.sentence == item["sentence"]
                ),
                None,
            )

            if existing_card is None:
                create_card(
                    session,
                    word=word,
                    sentence=item["sentence"],
                    translations=item["translations"],
                    state="new",
                )
                created.append(f"card:{item['normalized']}")

    if created:
        print("Demo data added:")
        for item in created:
            print(f"  - {item}")
    else:
        print("Demo data already exists; nothing changed.")


if __name__ == "__main__":
    main()
