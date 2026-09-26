"""Create initial learning data schema.

Revision ID: 0001_learning_data
Revises:
Create Date: 2026-09-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_learning_data"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "texts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("original_text", sa.Text(), nullable=False),
        sa.Column("edited_text", sa.Text(), nullable=False),
        sa.Column("reading_position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_opened_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_texts_last_opened_at", "texts", ["last_opened_at"])

    op.create_table(
        "words",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("surface", sa.String(length=240), nullable=False),
        sa.Column("normalized", sa.String(length=240), nullable=False),
        sa.Column("lemma", sa.String(length=240)),
        sa.Column("root", sa.String(length=64)),
        sa.Column("part_of_speech", sa.String(length=64)),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="new"),
        sa.Column("seen_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("normalized", name="uq_words_normalized"),
    )
    op.create_index("ix_words_status", "words", ["status"])
    op.create_index("ix_words_last_seen_at", "words", ["last_seen_at"])

    op.create_table(
        "encounters",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("word_id", sa.Integer(), sa.ForeignKey("words.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text_id", sa.Integer(), sa.ForeignKey("texts.id", ondelete="CASCADE")),
        sa.Column("sentence", sa.Text(), nullable=False, server_default=""),
        sa.Column("position", sa.Integer()),
        sa.Column("seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_encounters_word_seen_at", "encounters", ["word_id", "seen_at"])
    op.create_index("ix_encounters_text_id", "encounters", ["text_id"])

    op.create_table(
        "cards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("word_id", sa.Integer(), sa.ForeignKey("words.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sentence", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "translations",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("state", sa.String(length=24), nullable=False, server_default="new"),
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lapse_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("interval_days", sa.Float(), nullable=False, server_default="0"),
        sa.Column("difficulty", sa.Float()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_reviewed_at", sa.DateTime(timezone=True)),
        sa.Column("next_review_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_cards_next_review_at", "cards", ["next_review_at"])
    op.create_index("ix_cards_state", "cards", ["state"])

    op.create_table(
        "review_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("card_id", sa.Integer(), sa.ForeignKey("cards.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rating", sa.String(length=16), nullable=False),
        sa.Column("previous_interval", sa.Float(), nullable=False, server_default="0"),
        sa.Column("next_interval", sa.Float(), nullable=False, server_default="0"),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_review_events_reviewed_at", "review_events", ["reviewed_at"])
    op.create_index("ix_review_events_card_reviewed_at", "review_events", ["card_id", "reviewed_at"])

    op.create_table(
        "study_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("mode", sa.String(length=24), nullable=False),
        sa.Column("text_id", sa.Integer(), sa.ForeignKey("texts.id", ondelete="SET NULL")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("active_seconds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_study_sessions_started_at", "study_sessions", ["started_at"])
    op.create_index("ix_study_sessions_mode", "study_sessions", ["mode"])


def downgrade() -> None:
    op.drop_index("ix_study_sessions_mode", table_name="study_sessions")
    op.drop_index("ix_study_sessions_started_at", table_name="study_sessions")
    op.drop_table("study_sessions")
    op.drop_index("ix_review_events_card_reviewed_at", table_name="review_events")
    op.drop_index("ix_review_events_reviewed_at", table_name="review_events")
    op.drop_table("review_events")
    op.drop_index("ix_cards_state", table_name="cards")
    op.drop_index("ix_cards_next_review_at", table_name="cards")
    op.drop_table("cards")
    op.drop_index("ix_encounters_text_id", table_name="encounters")
    op.drop_index("ix_encounters_word_seen_at", table_name="encounters")
    op.drop_table("encounters")
    op.drop_index("ix_words_last_seen_at", table_name="words")
    op.drop_index("ix_words_status", table_name="words")
    op.drop_table("words")
    op.drop_index("ix_texts_last_opened_at", table_name="texts")
    op.drop_table("texts")
