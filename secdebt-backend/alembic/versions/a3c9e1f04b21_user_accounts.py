"""user accounts: users, sessions, per-user scans and GitHub connections

Revision ID: a3c9e1f04b21
Revises: 17c55607dd06
Create Date: 2026-10-31 12:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a3c9e1f04b21"
down_revision: Union[str, Sequence[str], None] = "17c55607dd06"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_sessions",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    op.create_index("ix_user_sessions_user_id", "user_sessions", ["user_id"])

    # Existing scans keep user_id NULL; the first account to sign up claims them
    with op.batch_alter_table("scans") as batch:
        batch.add_column(sa.Column("user_id", sa.String(length=36), nullable=True))
        batch.create_index("ix_scans_user_id", ["user_id"])
        batch.create_foreign_key("fk_scans_user_id", "users", ["user_id"], ["id"], ondelete="CASCADE")

    # The single-row connection becomes one row per user. Any old connection
    # has no owner, so it is dropped (reconnect in Settings).
    op.drop_table("github_connection")
    op.create_table(
        "github_connection",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=1024), nullable=True),
        sa.Column("profile_url", sa.String(length=1024), nullable=True),
        sa.Column("scopes", sa.String(length=512), nullable=False),
        sa.Column("connected_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("github_connection")
    op.create_table(
        "github_connection",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("avatar_url", sa.String(length=1024), nullable=True),
        sa.Column("profile_url", sa.String(length=1024), nullable=True),
        sa.Column("scopes", sa.String(length=512), nullable=False),
        sa.Column("connected_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("scans") as batch:
        batch.drop_constraint("fk_scans_user_id", type_="foreignkey")
        batch.drop_index("ix_scans_user_id")
        batch.drop_column("user_id")
    op.drop_index("ix_user_sessions_user_id", table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
