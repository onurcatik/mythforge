"""Add permission-safe RAG workspace memory tables.

Revision ID: 20260613_0098
Revises: 20260607_0097
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision = "20260613_0098"
down_revision = "20260607_0097"
branch_labels = None
depends_on = None

IS_SUPER = "current_setting('app.is_superadmin', true) = 'true'"
CURRENT_GUILD = "NULLIF(current_setting('app.current_guild_id', true), '')::integer"
CURRENT_USER = "NULLIF(current_setting('app.current_user_id', true), '')::integer"
PAM_GUILD = "NULLIF(current_setting('app.pam_guild_id', true), '')::integer"
PAM_READ = "current_setting('app.pam_read', true) = 'true'"
PAM_WRITE = "current_setting('app.pam_write', true) = 'true'"


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    conn.execute(text("CREATE TYPE rag_source_type AS ENUM ('initiative', 'project', 'task', 'document', 'comment', 'decision', 'system_event')"))
    conn.execute(text("CREATE TYPE rag_job_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'skipped')"))

    conn.execute(text("""
        CREATE TABLE rag_chunks (
            id SERIAL PRIMARY KEY,
            guild_id INTEGER NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
            initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
            project_id INTEGER NULL REFERENCES projects(id) ON DELETE CASCADE,
            entity_type rag_source_type NOT NULL,
            entity_id INTEGER NOT NULL,
            chunk_index INTEGER NOT NULL,
            title VARCHAR(512) NOT NULL,
            content TEXT NOT NULL,
            excerpt VARCHAR(1000) NOT NULL,
            source_version VARCHAR(128) NOT NULL,
            content_hash VARCHAR(64) NOT NULL,
            embedding_model VARCHAR(128) NOT NULL,
            embedding_dimension INTEGER NOT NULL,
            embedding vector(384),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            visibility_scope VARCHAR(64) NOT NULL DEFAULT 'guild',
            created_by_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            deleted_at TIMESTAMPTZ NULL,
            CONSTRAINT uq_rag_chunk_identity UNIQUE(entity_type, entity_id, chunk_index, source_version, embedding_model, embedding_dimension)
        )
    """))
    conn.execute(text("CREATE INDEX ix_rag_chunks_guild_id ON rag_chunks(guild_id)"))
    conn.execute(text("CREATE INDEX ix_rag_chunks_initiative_id ON rag_chunks(initiative_id)"))
    conn.execute(text("CREATE INDEX ix_rag_chunks_project_id ON rag_chunks(project_id)"))
    conn.execute(text("CREATE INDEX ix_rag_chunks_entity ON rag_chunks(entity_type, entity_id)"))
    conn.execute(text("CREATE INDEX ix_rag_chunks_deleted_at ON rag_chunks(deleted_at)"))
    conn.execute(text("CREATE INDEX ix_rag_chunks_content_hash ON rag_chunks(content_hash)"))
    conn.execute(text("CREATE INDEX ix_rag_chunks_metadata ON rag_chunks USING gin(metadata)"))
    conn.execute(text("CREATE INDEX ix_rag_chunks_embedding_hnsw ON rag_chunks USING hnsw (embedding vector_cosine_ops)"))

    op.create_table(
        "rag_index_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("entity_type", postgresql.ENUM("initiative", "project", "task", "document", "comment", "decision", "system_event", name="rag_source_type", create_type=False), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("source_version", sa.String(length=128), nullable=False),
        sa.Column("status", postgresql.ENUM("queued", "processing", "completed", "failed", "skipped", name="rag_job_status", create_type=False), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("run_after", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("entity_type", "entity_id", "source_version", name="uq_rag_index_job_version"),
    )
    op.create_index("ix_rag_index_jobs_guild_id", "rag_index_jobs", ["guild_id"])
    op.create_index("ix_rag_index_jobs_status", "rag_index_jobs", ["status"])
    op.create_index("ix_rag_index_jobs_run_after", "rag_index_jobs", ["run_after"])
    op.create_index("ix_rag_index_jobs_entity", "rag_index_jobs", ["entity_type", "entity_id"])

    op.create_table(
        "rag_audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("query_hash", sa.String(length=64), nullable=False),
        sa.Column("source_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("permission_filtered_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("embedding_model", sa.String(length=128), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("token_usage", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("cost_estimate", sa.Float(), nullable=True),
        sa.Column("cache_hit", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("safety_flags", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_rag_audit_logs_user_id", "rag_audit_logs", ["user_id"])
    op.create_index("ix_rag_audit_logs_guild_id", "rag_audit_logs", ["guild_id"])
    op.create_index("ix_rag_audit_logs_query_hash", "rag_audit_logs", ["query_hash"])
    op.create_index("ix_rag_audit_logs_created_at", "rag_audit_logs", ["created_at"])

    for table in ("rag_chunks", "rag_index_jobs", "rag_audit_logs"):
        conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        conn.execute(text(f"CREATE POLICY guild_isolation ON {table} FOR ALL USING (guild_id = {CURRENT_GUILD} OR {IS_SUPER}) WITH CHECK (guild_id = {CURRENT_GUILD} OR {IS_SUPER})"))
        conn.execute(text(f"CREATE POLICY {table}_pam_read ON {table} FOR SELECT USING (guild_id = {PAM_GUILD} AND {PAM_READ})"))

    conn.execute(text(f"CREATE POLICY rag_chunks_initiative_member ON rag_chunks AS RESTRICTIVE FOR ALL USING (is_initiative_member(initiative_id, {CURRENT_USER}) OR {IS_SUPER} OR (guild_id = {PAM_GUILD} AND {PAM_READ})) WITH CHECK (is_initiative_member(initiative_id, {CURRENT_USER}) OR {IS_SUPER} OR (guild_id = {PAM_GUILD} AND {PAM_WRITE}))"))
    conn.execute(text(f"CREATE POLICY rag_index_jobs_pam_write ON rag_index_jobs FOR ALL USING (guild_id = {PAM_GUILD} AND {PAM_WRITE}) WITH CHECK (guild_id = {PAM_GUILD} AND {PAM_WRITE})"))


def downgrade() -> None:
    conn = op.get_bind()
    for table in ("rag_chunks", "rag_index_jobs", "rag_audit_logs"):
        conn.execute(text(f"DROP POLICY IF EXISTS {table}_pam_read ON {table}"))
        conn.execute(text(f"DROP POLICY IF EXISTS guild_isolation ON {table}"))
    conn.execute(text("DROP POLICY IF EXISTS rag_chunks_initiative_member ON rag_chunks"))
    conn.execute(text("DROP POLICY IF EXISTS rag_index_jobs_pam_write ON rag_index_jobs"))
    op.drop_table("rag_audit_logs")
    op.drop_table("rag_index_jobs")
    conn.execute(text("DROP TABLE IF EXISTS rag_chunks"))
    conn.execute(text("DROP TYPE IF EXISTS rag_job_status"))
    conn.execute(text("DROP TYPE IF EXISTS rag_source_type"))
