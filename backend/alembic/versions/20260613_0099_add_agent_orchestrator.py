"""Add approval-first LLM agent orchestrator tables.

Revision ID: 20260613_0099
Revises: 20260613_0098
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision = "20260613_0099"
down_revision = "20260613_0098"
branch_labels = None
depends_on = None

IS_SUPER = "current_setting('app.is_superadmin', true) = 'true'"
CURRENT_GUILD = "NULLIF(current_setting('app.current_guild_id', true), '')::integer"
PAM_GUILD = "NULLIF(current_setting('app.pam_guild_id', true), '')::integer"
PAM_READ = "current_setting('app.pam_read', true) = 'true'"
PAM_WRITE = "current_setting('app.pam_write', true) = 'true'"


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("CREATE TYPE agent_session_status AS ENUM ('planning', 'awaiting_approval', 'approved', 'executing', 'completed', 'failed', 'rejected', 'rolled_back')"))
    conn.execute(text("CREATE TYPE agent_step_action AS ENUM ('create_initiative', 'create_project', 'create_task', 'create_subtask', 'assign_user', 'set_deadline', 'add_dependency', 'update_entity', 'archive_entity')"))
    conn.execute(text("CREATE TYPE agent_step_status AS ENUM ('proposed', 'approved', 'rejected', 'executing', 'executed', 'failed', 'rolled_back', 'skipped')"))
    conn.execute(text("CREATE TYPE agent_approval_decision AS ENUM ('approve', 'reject', 'edit_before_approve', 'regenerate')"))

    op.create_table(
        "agent_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("goal", sa.Text(), nullable=False),
        sa.Column("normalized_goal", sa.Text(), nullable=False),
        sa.Column("status", postgresql.ENUM(name="agent_session_status", create_type=False), nullable=False, server_default="planning"),
        sa.Column("plan_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("assumptions", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("risks", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("required_approvals", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("context_summary", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agent_sessions_guild_id", "agent_sessions", ["guild_id"])
    op.create_index("ix_agent_sessions_initiative_id", "agent_sessions", ["initiative_id"])
    op.create_index("ix_agent_sessions_project_id", "agent_sessions", ["project_id"])
    op.create_index("ix_agent_sessions_user_id", "agent_sessions", ["user_id"])
    op.create_index("ix_agent_sessions_status", "agent_sessions", ["status"])
    op.create_index("ix_agent_sessions_created_at", "agent_sessions", ["created_at"])

    op.create_table(
        "agent_plan_steps",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("step_order", sa.Integer(), nullable=False),
        sa.Column("action", postgresql.ENUM(name="agent_step_action", create_type=False), nullable=False),
        sa.Column("status", postgresql.ENUM(name="agent_step_status", create_type=False), nullable=False, server_default="proposed"),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("proposed_patch", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("current_snapshot", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("diff", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("requires_approval", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("approved_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("session_id", "step_order", name="uq_agent_plan_step_order"),
    )
    op.create_index("ix_agent_plan_steps_session_id", "agent_plan_steps", ["session_id"])
    op.create_index("ix_agent_plan_steps_guild_id", "agent_plan_steps", ["guild_id"])
    op.create_index("ix_agent_plan_steps_initiative_id", "agent_plan_steps", ["initiative_id"])
    op.create_index("ix_agent_plan_steps_project_id", "agent_plan_steps", ["project_id"])
    op.create_index("ix_agent_plan_steps_action", "agent_plan_steps", ["action"])
    op.create_index("ix_agent_plan_steps_status", "agent_plan_steps", ["status"])
    op.create_index("ix_agent_plan_steps_entity_id", "agent_plan_steps", ["entity_id"])

    op.create_table(
        "agent_approvals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("step_id", sa.Integer(), sa.ForeignKey("agent_plan_steps.id", ondelete="CASCADE"), nullable=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("decision", postgresql.ENUM(name="agent_approval_decision", create_type=False), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("plan_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agent_approvals_session_id", "agent_approvals", ["session_id"])
    op.create_index("ix_agent_approvals_step_id", "agent_approvals", ["step_id"])
    op.create_index("ix_agent_approvals_guild_id", "agent_approvals", ["guild_id"])
    op.create_index("ix_agent_approvals_initiative_id", "agent_approvals", ["initiative_id"])
    op.create_index("ix_agent_approvals_user_id", "agent_approvals", ["user_id"])
    op.create_index("ix_agent_approvals_decision", "agent_approvals", ["decision"])
    op.create_index("ix_agent_approvals_created_at", "agent_approvals", ["created_at"])

    op.create_table(
        "agent_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("prompt_hash", sa.String(length=64), nullable=True),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("token_usage", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("latency_ms", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agent_audit_events_session_id", "agent_audit_events", ["session_id"])
    op.create_index("ix_agent_audit_events_user_id", "agent_audit_events", ["user_id"])
    op.create_index("ix_agent_audit_events_guild_id", "agent_audit_events", ["guild_id"])
    op.create_index("ix_agent_audit_events_initiative_id", "agent_audit_events", ["initiative_id"])
    op.create_index("ix_agent_audit_events_event_type", "agent_audit_events", ["event_type"])
    op.create_index("ix_agent_audit_events_prompt_hash", "agent_audit_events", ["prompt_hash"])
    op.create_index("ix_agent_audit_events_created_at", "agent_audit_events", ["created_at"])

    for table in ("agent_sessions", "agent_plan_steps", "agent_approvals", "agent_audit_events"):
        conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        conn.execute(text(f"CREATE POLICY guild_isolation ON {table} FOR ALL USING (guild_id = {CURRENT_GUILD} OR {IS_SUPER}) WITH CHECK (guild_id = {CURRENT_GUILD} OR {IS_SUPER})"))
        conn.execute(text(f"CREATE POLICY {table}_pam_read ON {table} FOR SELECT USING (guild_id = {PAM_GUILD} AND {PAM_READ})"))
        conn.execute(text(f"CREATE POLICY {table}_pam_write ON {table} FOR INSERT WITH CHECK (guild_id = {PAM_GUILD} AND {PAM_WRITE})"))


def downgrade() -> None:
    conn = op.get_bind()
    for table in ("agent_audit_events", "agent_approvals", "agent_plan_steps", "agent_sessions"):
        conn.execute(text(f"DROP POLICY IF EXISTS {table}_pam_write ON {table}"))
        conn.execute(text(f"DROP POLICY IF EXISTS {table}_pam_read ON {table}"))
        conn.execute(text(f"DROP POLICY IF EXISTS guild_isolation ON {table}"))
    op.drop_table("agent_audit_events")
    op.drop_table("agent_approvals")
    op.drop_table("agent_plan_steps")
    op.drop_table("agent_sessions")
    conn.execute(text("DROP TYPE IF EXISTS agent_approval_decision"))
    conn.execute(text("DROP TYPE IF EXISTS agent_step_status"))
    conn.execute(text("DROP TYPE IF EXISTS agent_step_action"))
    conn.execute(text("DROP TYPE IF EXISTS agent_session_status"))
