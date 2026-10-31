"""scan repo_key: stable repository identity for scan history comparisons

Revision ID: c5d2a7e9f310
Revises: a3c9e1f04b21
Create Date: 2026-10-31 23:30:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c5d2a7e9f310"
down_revision: Union[str, Sequence[str], None] = "a3c9e1f04b21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("scans") as batch:
        batch.add_column(sa.Column("repo_key", sa.String(length=512), nullable=True))
        batch.create_index("ix_scans_repo_key", ["repo_key"])

    # Older scans never stored the GitHub owner; key them by source and name
    op.execute("UPDATE scans SET repo_key = lower(source || ':' || repo_name) WHERE repo_key IS NULL")


def downgrade() -> None:
    with op.batch_alter_table("scans") as batch:
        batch.drop_index("ix_scans_repo_key")
        batch.drop_column("repo_key")
