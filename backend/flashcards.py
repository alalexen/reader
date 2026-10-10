"""Persistent flashcard operations for the local single-user API."""

from datetime import datetime

from sqlalchemy import select

from .database import session_scope
from .models import Card, ReviewEvent, Word
from .review_scheduler import schedule_review

MAX_IMPORT_CARDS = 5000


def validate_card(payload):
    """Validate and normalize one incoming saved-word payload."""
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
    saved_at = payload.get("savedAt")
    try:
        original_date = (
            datetime.fromisoformat(saved_at.replace("Z", "+00:00"))
            if isinstance(saved_at, str) else None
        )
        if original_date is not None and original_date.tzinfo is None:
            original_date = None
    except ValueError:
        original_date = None
    return {
        "word": word.strip(),
        "sentence": sentence,
        "translations": cleaned,
        "saved_at": original_date,
    }


def serialize(card):
    """Convert a stored card into the public response shape."""
    return {
        "id": card.id,
        "word": card.word.surface,
        "sentence": card.sentence,
        "translations": card.translations,
        "savedAt": card.created_at.isoformat() if card.created_at else None,
        "state": card.state,
        "nextReviewAt": card.next_review_at.isoformat() if card.next_review_at else None,
    }


def all_cards(session):
    """Read saved cards in stable newest-first order."""
    return session.scalars(
        select(Card).join(Word).order_by(Card.created_at.desc(), Card.id.desc())
    ).all()


def list_flashcards():
    """Read all saved cards from the database."""
    with session_scope() as session:
        return [serialize(card) for card in all_cards(session)]


def upsert(session, data, *, overwrite, import_legacy=False):
    """Create or update a saved word without duplicating an imported card."""
    word = session.scalar(select(Word).where(Word.normalized == data["word"]))
    if word is None:
        word = Word(surface=data["word"], normalized=data["word"], status="learning")
        session.add(word)
        session.flush()
    card = session.scalar(select(Card).where(Card.word_id == word.id).order_by(Card.id))
    if card is None:
        card = Card(word=word, sentence=data["sentence"], translations=data["translations"], state="new")
        if import_legacy and data.get("saved_at") is not None:
            card.created_at = data["saved_at"]
        session.add(card)
        session.flush()
    elif overwrite:
        card.sentence = data["sentence"]
        card.translations = data["translations"]
    if word.status == "new":
        word.status = "learning"
    return card


def save_flashcard(payload):
    """Save a card transactionally and return the refreshed list."""
    data = validate_card(payload)
    with session_scope() as session:
        upsert(session, data, overwrite=True)
        return [serialize(card) for card in all_cards(session)]


def import_flashcards(payload):
    """Import validated legacy cards in one transaction."""
    if not isinstance(payload, dict) or not isinstance(payload.get("cards"), list):
        raise ValueError("Expected a cards array.")
    cards = payload["cards"]
    if len(cards) > MAX_IMPORT_CARDS:
        raise ValueError("Too many cards in one import.")
    # Validate the complete batch before opening a write transaction.
    validated = [validate_card(card) for card in cards]
    with session_scope() as session:
        for card in validated:
            upsert(session, card, overwrite=False, import_legacy=True)
        return [serialize(card) for card in all_cards(session)]


def delete_flashcard(card_id):
    """Delete a card by identifier in a database transaction."""
    if not isinstance(card_id, int) or card_id < 1:
        raise ValueError("Invalid card ID.")
    with session_scope() as session:
        card = session.get(Card, card_id)
        if card is None:
            return False
        session.delete(card)
        return True



def rate_flashcard(card_id, rating):
    """Record a validated review grade and update its schedule."""
    if not isinstance(card_id, int) or card_id < 1:
        raise ValueError("Invalid card ID.")
    with session_scope() as session:
        card = session.get(Card, card_id)
        if card is None:
            return None
        previous, interval = schedule_review(card, rating)
        session.add(ReviewEvent(
            card=card,
            rating=rating,
            previous_interval=previous,
            next_interval=interval,
        ))
        session.flush()
        return serialize(card)
