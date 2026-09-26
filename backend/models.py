"""Persistent learning-data models for the single-user application."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class ReadingText(Base):
    __tablename__ = "texts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False, default="pasted")
    original_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    edited_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reading_position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    extra: Mapped[dict] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    encounters: Mapped[list["Encounter"]] = relationship(
        back_populates="text",
        cascade="all, delete-orphan",
    )
    sessions: Mapped[list["StudySession"]] = relationship(back_populates="text")

    __table_args__ = (Index("ix_texts_last_opened_at", "last_opened_at"),)


class Word(Base):
    __tablename__ = "words"

    id: Mapped[int] = mapped_column(primary_key=True)
    surface: Mapped[str] = mapped_column(String(240), nullable=False)
    normalized: Mapped[str] = mapped_column(String(240), nullable=False)
    lemma: Mapped[str | None] = mapped_column(String(240))
    root: Mapped[str | None] = mapped_column(String(64))
    part_of_speech: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="new")
    seen_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    encounters: Mapped[list["Encounter"]] = relationship(
        back_populates="word",
        cascade="all, delete-orphan",
    )
    cards: Mapped[list["Card"]] = relationship(
        back_populates="word",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("normalized", name="uq_words_normalized"),
        Index("ix_words_status", "status"),
        Index("ix_words_last_seen_at", "last_seen_at"),
    )


class Encounter(Base):
    __tablename__ = "encounters"

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.id", ondelete="CASCADE"),
        nullable=False,
    )
    text_id: Mapped[int | None] = mapped_column(
        ForeignKey("texts.id", ondelete="CASCADE"),
    )
    sentence: Mapped[str] = mapped_column(Text, nullable=False, default="")
    position: Mapped[int | None] = mapped_column(Integer)
    seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    word: Mapped[Word] = relationship(back_populates="encounters")
    text: Mapped[ReadingText | None] = relationship(back_populates="encounters")

    __table_args__ = (
        Index("ix_encounters_word_seen_at", "word_id", "seen_at"),
        Index("ix_encounters_text_id", "text_id"),
    )


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(primary_key=True)
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.id", ondelete="CASCADE"),
        nullable=False,
    )
    sentence: Mapped[str] = mapped_column(Text, nullable=False, default="")
    translations: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    state: Mapped[str] = mapped_column(String(24), nullable=False, default="new")
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    lapse_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    interval_days: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    difficulty: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    last_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    word: Mapped[Word] = relationship(back_populates="cards")
    review_events: Mapped[list["ReviewEvent"]] = relationship(
        back_populates="card",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_cards_next_review_at", "next_review_at"),
        Index("ix_cards_state", "state"),
    )


class ReviewEvent(Base):
    __tablename__ = "review_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(
        ForeignKey("cards.id", ondelete="CASCADE"),
        nullable=False,
    )
    rating: Mapped[str] = mapped_column(String(16), nullable=False)
    previous_interval: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    next_interval: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    card: Mapped[Card] = relationship(back_populates="review_events")

    __table_args__ = (
        Index("ix_review_events_reviewed_at", "reviewed_at"),
        Index("ix_review_events_card_reviewed_at", "card_id", "reviewed_at"),
    )


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    mode: Mapped[str] = mapped_column(String(24), nullable=False)
    text_id: Mapped[int | None] = mapped_column(
        ForeignKey("texts.id", ondelete="SET NULL"),
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    text: Mapped[ReadingText | None] = relationship(back_populates="sessions")

    __table_args__ = (
        Index("ix_study_sessions_started_at", "started_at"),
        Index("ix_study_sessions_mode", "mode"),
    )
