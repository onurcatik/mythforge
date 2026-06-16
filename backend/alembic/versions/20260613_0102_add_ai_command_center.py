"""Add AI command center sessions and audit events.

Revision ID: 20260613_0102
Revises: 20260613_0101
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision = "20260613_0102"
down_revision = "20260613_0101"
branch_labels = None
depends_on = None

IS_SUPER = "current_setting('app.is_superadmin', true) = 'true'"
CURRENT_GUILD = "NULLIF(current_setting('app.current_guild_id', true), '')::integer"
PAM_GUILD = "NULLIF(current_setting('app.pam_guild_id', true), '')::integer"
PAM_READ = "current_setting('app.pam_read', true) = 'true'"
PAM_WRITE = "current_setting('app.pam_write', true) = 'true'"


def _enable_rls(conn, table: str) -> None:
    conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
    conn.execute(text(f"CREATE POLICY guild_isolation ON {table} FOR ALL USING (guild_id = {CURRENT_GUILD} OR {IS_SUPER}) WITH CHECK (guild_id = {CURRENT_GUILD} OR {IS_SUPER})"))
    conn.execute(text(f"CREATE POLICY {table}_pam_read ON {table} FOR SELECT USING (guild_id = {PAM_GUILD} AND {PAM_READ})"))
    conn.execute(text(f"CREATE POLICY {table}_pam_write ON {table} FOR ALL USING (guild_id = {PAM_GUILD} AND {PAM_WRITE}) WITH CHECK (guild_id = {PAM_GUILD} AND {PAM_WRITE})"))


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("CREATE TYPE command_intent AS ENUM ('ask_workspace','plan_project','summarize_project','show_risks','reorder_tasks','assign_tasks','impact_analysis','convert_meeting_notes','create_tasks','resolve_blockers','project_cleanup','open_entity')"))
    conn.execute(text("CREATE TYPE command_session_status AS ENUM ('interpreted','running','awaiting_approval','completed','failed','rejected')"))
    conn.execute(text("CREATE TYPE command_audit_action AS ENUM ('interpret','execute','delegate','policy_block','error')"))

    op.create_table(
        "command_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("command_text_hash", sa.String(length=64), nullable=False),
        sa.Column("command_preview", sa.Text(), nullable=False, server_default=""),
        sa.Column("intent", postgresql.ENUM(name="command_intent", create_type=False), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", postgresql.ENUM(name="command_session_status", create_type=False), nullable=False, server_default="interpreted"),
        sa.Column("required_context", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("suggested_actions", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("safety_flags", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("result", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("used_tools", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("approval_state", sa.String(length=64), nullable=False, server_default="not_required"),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    for name, cols in {
        "ix_command_sessions_guild_id": ["guild_id"],
        "ix_command_sessions_initiative_id": ["initiative_id"],
        "ix_command_sessions_project_id": ["project_id"],
        "ix_command_sessions_user_id": ["user_id"],
        "ix_command_sessions_command_text_hash": ["command_text_hash"],
        "ix_command_sessions_intent": ["intent"],
        "ix_command_sessions_status": ["status"],
        "ix_command_sessions_approval_state": ["approval_state"],
        "ix_command_sessions_created_at": ["created_at"],
    }.items():
        op.create_index(name, "command_sessions", cols)
    conn.execute(text("CREATE INDEX ix_command_sessions_required_context ON command_sessions USING gin(required_context)"))
    conn.execute(text("CREATE INDEX ix_command_sessions_result ON command_sessions USING gin(result)"))

    op.create_table(
        "command_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("command_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", postgresql.ENUM(name="command_audit_action", create_type=False), nullable=False),
        sa.Column("intent", postgresql.ENUM(name="command_intent", create_type=False), nullable=True),
        sa.Column("command_text_hash", sa.String(length=64), nullable=True),
        sa.Column("used_tools", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("approval_state", sa.String(length=64), nullable=False, server_default="not_required"),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for name, cols in {
        "ix_command_audit_events_session_id": ["session_id"],
        "ix_command_audit_events_guild_id": ["guild_id"],
        "ix_command_audit_events_initiative_id": ["initiative_id"],
        "ix_command_audit_events_project_id": ["project_id"],
        "ix_command_audit_events_user_id": ["user_id"],
        "ix_command_audit_events_action": ["action"],
        "ix_command_audit_events_intent": ["intent"],
        "ix_command_audit_events_command_text_hash": ["command_text_hash"],
        "ix_command_audit_events_approval_state": ["approval_state"],
        "ix_command_audit_events_created_at": ["created_at"],
    }.items():
        op.create_index(name, "command_audit_events", cols)
    conn.execute(text("CREATE INDEX ix_command_audit_events_payload ON command_audit_events USING gin(payload)"))

    for table in ["command_sessions", "command_audit_events"]:
        _enable_rls(conn, table)


def downgrade() -> None:
    conn = op.get_bind()
    op.drop_table("command_audit_events")
    op.drop_table("command_sessions")
    conn.execute(text("DROP TYPE IF EXISTS command_audit_action"))
    conn.execute(text("DROP TYPE IF EXISTS command_session_status"))
    conn.execute(text("DROP TYPE IF EXISTS command_intent"))
