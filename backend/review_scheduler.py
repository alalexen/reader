"""Simple deterministic spaced-repetition scheduler (UTC timestamps)."""

from datetime import datetime, timedelta, timezone

RATINGS = frozenset({"again", "hard", "good", "easy"})


def schedule_review(card, rating, now=None):
    if rating not in RATINGS:
        raise ValueError("Rating must be again, hard, good or easy.")
    now = now or datetime.now(timezone.utc)
    prior = max(0.0, float(card.interval_days or 0))
    if rating == "again":
        days = 10 / 1440  # Retry in ten minutes.
        card.lapse_count += 1
        state = "learning"
    elif rating == "hard":
        days = 1 if prior == 0 else max(1, prior * 1.2)
        state = "learning"
    elif rating == "good":
        days = 1 if prior == 0 else max(2, prior * 2.5)
        state = "review"
    else:
        days = 4 if prior == 0 else max(4, prior * 3.5)
        state = "review"
    card.interval_days = days
    card.next_review_at = now + timedelta(days=days)
    card.last_reviewed_at = now
    card.review_count += 1
    card.state = state
    return prior, days
