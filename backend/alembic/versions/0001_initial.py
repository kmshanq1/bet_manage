"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

user_role = postgresql.ENUM("admin", "user", name="userrole", create_type=False)
bet_kind = postgresql.ENUM("single", "parlay", name="betkind", create_type=False)
bet_status = postgresql.ENUM("pending", "won", "lost", "pushed", "void", "half_won", "half_lost", name="betstatus", create_type=False)


def upgrade() -> None:
    user_role.create(op.get_bind(), checkfirst=True)
    bet_kind.create(op.get_bind(), checkfirst=True)
    bet_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="user"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "bets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", bet_kind, nullable=False),
        sa.Column("sport", sa.String(length=64), nullable=False),
        sa.Column("league", sa.String(length=128), nullable=True),
        sa.Column("event_name", sa.String(length=255), nullable=False),
        sa.Column("market", sa.String(length=128), nullable=False),
        sa.Column("selection", sa.String(length=255), nullable=False),
        sa.Column("odds", sa.Numeric(10, 3), nullable=False),
        sa.Column("stake", sa.Numeric(12, 2), nullable=False),
        sa.Column("platform", sa.String(length=128), nullable=True),
        sa.Column("placed_at", sa.DateTime(), nullable=False),
        sa.Column("status", bet_status, nullable=False, server_default="pending"),
        sa.Column("payout", sa.Numeric(12, 2), nullable=True),
        sa.Column("profit", sa.Numeric(12, 2), nullable=True),
        sa.Column("pre_match_thoughts", sa.Text(), nullable=True),
        sa.Column("post_match_review", sa.Text(), nullable=True),
        sa.Column("mistake_category", sa.String(length=128), nullable=True),
        sa.Column("confidence", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    for column in ["user_id", "kind", "sport", "platform", "placed_at", "status"]:
        op.create_index(op.f(f"ix_bets_{column}"), "bets", [column])

    op.create_table(
        "bet_legs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bet_id", sa.Integer(), sa.ForeignKey("bets.id"), nullable=False),
        sa.Column("sport", sa.String(length=64), nullable=False),
        sa.Column("league", sa.String(length=128), nullable=True),
        sa.Column("event_name", sa.String(length=255), nullable=False),
        sa.Column("market", sa.String(length=128), nullable=False),
        sa.Column("selection", sa.String(length=255), nullable=False),
        sa.Column("odds", sa.Numeric(10, 3), nullable=False),
        sa.Column("status", bet_status, nullable=False, server_default="pending"),
    )
    op.create_index(op.f("ix_bet_legs_bet_id"), "bet_legs", ["bet_id"])

    op.create_table(
        "tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
    )
    op.create_index(op.f("ix_tags_user_id"), "tags", ["user_id"])

    op.create_table(
        "bet_tags",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bet_id", sa.Integer(), sa.ForeignKey("bets.id"), nullable=False),
        sa.Column("tag_id", sa.Integer(), sa.ForeignKey("tags.id"), nullable=False),
        sa.UniqueConstraint("bet_id", "tag_id", name="uq_bet_tags_bet_tag"),
    )
    op.create_index(op.f("ix_bet_tags_bet_id"), "bet_tags", ["bet_id"])
    op.create_index(op.f("ix_bet_tags_tag_id"), "bet_tags", ["tag_id"])


def downgrade() -> None:
    op.drop_table("bet_tags")
    op.drop_table("tags")
    op.drop_table("bet_legs")
    op.drop_table("bets")
    op.drop_table("users")
    bet_status.drop(op.get_bind(), checkfirst=True)
    bet_kind.drop(op.get_bind(), checkfirst=True)
    user_role.drop(op.get_bind(), checkfirst=True)
