"""Add Local AI Mode runtime settings.

Revision ID: 20260613_0103
Revises: 20260613_0102
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa

revision = "20260613_0103"
down_revision = "20260613_0102"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("app_settings", sa.Column("ai_embedding_model", sa.String(length=500), nullable=True))
    op.add_column("app_settings", sa.Column("ai_local_only", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("guild_settings", sa.Column("ai_embedding_model", sa.String(length=500), nullable=True))
    op.add_column("guild_settings", sa.Column("ai_local_only", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("ai_embedding_model", sa.String(length=500), nullable=True))
    op.add_column("users", sa.Column("ai_local_only", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "ai_local_only")
    op.drop_column("users", "ai_embedding_model")
    op.drop_column("guild_settings", "ai_local_only")
    op.drop_column("guild_settings", "ai_embedding_model")
    op.drop_column("app_settings", "ai_local_only")
    op.drop_column("app_settings", "ai_embedding_model")
