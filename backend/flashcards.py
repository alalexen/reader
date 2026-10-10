"""Persistent flashcard operations for the local single-user API."""

from sqlalchemy import select

from .database import session_scope
from .models import Card, Word

MAX_IMPORT_CARDS = 5000


def validate_card(payload):
    if not isinstance(payload, dict):
        raise ValueError("Card must be an object.")
    word = payload.get("word")
    if not isinstance(word, str) or not word.strip() or len(word.strip()) > 240:
        raise ValueError("A Hebrew word of at most 240 characters is required.")
    sentence = payload.get("sentence", "")
    translations = payload.get("translations", {})
    if not isinstance(sentence, str) or len(sentence) > 10000:
        raise ValueError("Invalid sentence.")
    if not isinstance(translations, dict):
        raise ValueError("Invalid translations.")
    cleaned = {}
    for code in ("en", "ru", "uk"):
        value = translations.get(code, "")
        if not isinstance(value, str) or len(value) > 4000:
            raise ValueError("Invalid translation.")
        cleaned[code] = value
    return {"word": word.strip(), "sentence": sentence, "translations": cleaned}


def serialize(card):
    return {
        "id": card.id,
        "word": card.word.surface,
        "sentence": card.sentence,
        "translations": card.translations,
        "savedAt": card.created_at.isoformat() if card.created_at else None,
    }


def all_cards(session):
    return session.scalars(
        select(Card).join(Word).order_by(Card.created_at.desc(), Card.id.desc())
    ).all()


def list_flashcards():
    with session_scope() as session:
        return [serialize(card) for card in all_cards(session)]


def upsert(session, data, *, overwrite):
    word = session.scalar(select(Word).where(Word.normalized == data["word"]))
    if word is None:
        word = Word(surface=data["word"], normalized=data["word"], status="learning")
        session.add(word)
        session.flush()
    card = session.scalar(select(Card).where(Card.word_id == word.id).order_by(Card.id))
    if card is None:
        card = Card(word=word, sentence=data["sentence"], translations=data["translations"], state="new")
        session.add(card)
        session.flush()
    elif overwrite:
        card.sentence = data["sentence"]
        card.translations = data["translations"]
    if word.status == "new":
        word.status = "learning"
    return card


def save_flashcard(payload):
    data = validate_card(payload)
    with session_scope() as session:
        upsert(session, data, overwrite=True)
        return [serialize(card) for card in all_cards(session)]


def import_flashcards(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("cards"), list):
        raise ValueError("Expected a cards array.")
    cards = payload["cards"]
    if len(cards) > MAX_IMPORT_CARDS:
        raise ValueError("Too many cards in one import.")
    # Validate the complete batch before opening a write transaction.
    validated = [validate_card(card) for card in cards]
    with session_scope() as session:
        for card in validated:
            upsert(session, card, overwrite=False)
        return [serialize(card) for card in all_cards(session)]


def delete_flashcard(card_id):
    if not isinstance(card_id, int) or card_id < 1:
        raise ValueError("Invalid card ID.")
    with session_scope() as session:
        card = session.get(Card, card_id)
        if card is None:
            return False
        session.delete(card)
        return True
