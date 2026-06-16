"""Add AI assignment engine and task effort fields.

Revision ID: 20260613_0101
Revises: 20260613_0100
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision = "20260613_0101"
down_revision = "20260613_0100"
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
    conn.execute(text("CREATE TYPE assignment_mode AS ENUM ('recommend','auto','approval_required')"))
    conn.execute(text("CREATE TYPE assignment_recommendation_status AS ENUM ('draft','ready','approved','applied','rejected','expired','superseded','failed')"))
    conn.execute(text("CREATE TYPE assignment_action_type AS ENUM ('recommend','apply','reject','override','refresh','policy_block')"))

    op.add_column("tasks", sa.Column("estimated_effort_minutes", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("tasks", sa.Column("actual_effort_minutes", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("tasks", sa.Column("complexity_score", sa.Float(), nullable=False, server_default="1"))
    op.add_column("tasks", sa.Column("assignment_locked", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("tasks", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tasks", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_tasks_assignment_locked", "tasks", ["assignment_locked"])
    op.create_index("ix_tasks_completed_at", "tasks", ["completed_at"])

    op.create_table(
        "assignment_recommendations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recommended_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("mode", postgresql.ENUM(name="assignment_mode", create_type=False), nullable=False),
        sa.Column("status", postgresql.ENUM(name="assignment_recommendation_status", create_type=False), nullable=False, server_default="ready"),
        sa.Column("reasoning", sa.Text(), nullable=False, server_default=""),
        sa.Column("score_breakdown", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("policy_decision", sa.String(length=64), nullable=False, server_default="allow"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    for name, cols in {
        "ix_assignment_recommendations_guild_id": ["guild_id"],
        "ix_assignment_recommendations_initiative_id": ["initiative_id"],
        "ix_assignment_recommendations_project_id": ["project_id"],
        "ix_assignment_recommendations_task_id": ["task_id"],
        "ix_assignment_recommendations_recommended_user_id": ["recommended_user_id"],
        "ix_assignment_recommendations_mode": ["mode"],
        "ix_assignment_recommendations_status": ["status"],
        "ix_assignment_recommendations_policy_decision": ["policy_decision"],
        "ix_assignment_recommendations_expires_at": ["expires_at"],
        "ix_assignment_recommendations_created_at": ["created_at"],
    }.items():
        op.create_index(name, "assignment_recommendations", cols)
    conn.execute(text("CREATE INDEX ix_assignment_recommendations_score_breakdown ON assignment_recommendations USING gin(score_breakdown)"))

    op.create_table(
        "assignment_score_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("breakdown", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for name, cols in {
        "ix_assignment_score_snapshots_guild_id": ["guild_id"],
        "ix_assignment_score_snapshots_initiative_id": ["initiative_id"],
        "ix_assignment_score_snapshots_project_id": ["project_id"],
        "ix_assignment_score_snapshots_task_id": ["task_id"],
        "ix_assignment_score_snapshots_user_id": ["user_id"],
        "ix_assignment_score_snapshots_created_at": ["created_at"],
    }.items():
        op.create_index(name, "assignment_score_snapshots", cols)
    conn.execute(text("CREATE INDEX ix_assignment_score_snapshots_breakdown ON assignment_score_snapshots USING gin(breakdown)"))

    op.create_table(
        "user_capacity_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("active_task_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("overdue_task_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("blocker_owner_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("deadline_pressure_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_effort_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("availability", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"),
        sa.Column("role", sa.String(length=64), nullable=False, server_default="member"),
        sa.Column("calculated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_capacity_snapshots_guild_id", "user_capacity_snapshots", ["guild_id"])
    op.create_index("ix_user_capacity_snapshots_user_id", "user_capacity_snapshots", ["user_id"])
    op.create_index("ix_user_capacity_snapshots_calculated_at", "user_capacity_snapshots", ["calculated_at"])
    op.create_unique_constraint("uq_user_capacity_latest", "user_capacity_snapshots", ["guild_id", "user_id"])
    conn.execute(text("CREATE INDEX ix_user_capacity_snapshots_availability ON user_capacity_snapshots USING gin(availability)"))

    op.create_table(
        "assignment_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("old_assignee_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("new_assignee_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("recommendation_id", sa.Integer(), sa.ForeignKey("assignment_recommendations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action_type", postgresql.ENUM(name="assignment_action_type", create_type=False), nullable=False),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("policy_decision", sa.String(length=64), nullable=False, server_default="allow"),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for name, cols in {
        "ix_assignment_audit_events_guild_id": ["guild_id"],
        "ix_assignment_audit_events_initiative_id": ["initiative_id"],
        "ix_assignment_audit_events_project_id": ["project_id"],
        "ix_assignment_audit_events_task_id": ["task_id"],
        "ix_assignment_audit_events_user_id": ["user_id"],
        "ix_assignment_audit_events_recommendation_id": ["recommendation_id"],
        "ix_assignment_audit_events_action_type": ["action_type"],
        "ix_assignment_audit_events_policy_decision": ["policy_decision"],
        "ix_assignment_audit_events_created_at": ["created_at"],
    }.items():
        op.create_index(name, "assignment_audit_events", cols)
    conn.execute(text("CREATE INDEX ix_assignment_audit_events_payload ON assignment_audit_events USING gin(payload)"))

    for table in ["assignment_recommendations", "assignment_score_snapshots", "user_capacity_snapshots", "assignment_audit_events"]:
        _enable_rls(conn, table)


def downgrade() -> None:
    conn = op.get_bind()
    for table in ["assignment_audit_events", "user_capacity_snapshots", "assignment_score_snapshots", "assignment_recommendations"]:
        op.drop_table(table)
    op.drop_index("ix_tasks_completed_at", table_name="tasks")
    op.drop_index("ix_tasks_assignment_locked", table_name="tasks")
    for col in ["completed_at", "started_at", "assignment_locked", "complexity_score", "actual_effort_minutes", "estimated_effort_minutes"]:
        op.drop_column("tasks", col)
    conn.execute(text("DROP TYPE IF EXISTS assignment_action_type"))
    conn.execute(text("DROP TYPE IF EXISTS assignment_recommendation_status"))
    conn.execute(text("DROP TYPE IF EXISTS assignment_mode"))
