"""PostgreSQL connection and SQLAlchemy session helpers."""

from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")


class Base(DeclarativeBase):
    """Base class for persisted Hebrew Reader models."""


_engine = None
_session_factory = None


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not configured. Copy .env.example to .env "
            "and set your PostgreSQL connection URL."
        )
    return database_url


def get_engine():
    """Create the SQLAlchemy engine lazily."""
    global _engine

    if _engine is None:
        _engine = create_engine(
            get_database_url(),
            pool_pre_ping=True,
            future=True,
        )
    return _engine


def get_session_factory():
    global _session_factory

    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(),
            autoflush=False,
            expire_on_commit=False,
        )
    return _session_factory


@contextmanager
def session_scope():
    """Provide a transaction-scoped SQLAlchemy session."""
    session = get_session_factory()()

    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_database_connection() -> dict:
    """Return a small health result without exposing credentials."""
    with get_engine().connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "available": True,
        "provider": "postgresql",
    }
