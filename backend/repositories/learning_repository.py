"""Repository layer for persisted learning data."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Card, ReadingText, Word


def get_text_by_title(session: Session, title: str) -> ReadingText | None:
    return session.scalar(select(ReadingText).where(ReadingText.title == title))


def create_text(
    session: Session,
    *,
    title: str,
    kind: str,
    original_text: str,
    edited_text: str | None = None,
) -> ReadingText:
    text = ReadingText(
        title=title,
        kind=kind,
        original_text=original_text,
        edited_text=edited_text if edited_text is not None else original_text,
    )
    session.add(text)
    session.flush()
    return text


def get_word_by_normalized(session: Session, normalized: str) -> Word | None:
    return session.scalar(select(Word).where(Word.normalized == normalized))


def create_word(
    session: Session,
    *,
    surface: str,
    normalized: str,
    status: str = "new",
) -> Word:
    word = Word(
        surface=surface,
        normalized=normalized,
        status=status,
    )
    session.add(word)
    session.flush()
    return word


def create_card(
    session: Session,
    *,
    word: Word,
    sentence: str,
    translations: dict,
    state: str = "new",
) -> Card:
    card = Card(
        word=word,
        sentence=sentence,
        translations=translations,
        state=state,
    )
    session.add(card)
    session.flush()
    return card
