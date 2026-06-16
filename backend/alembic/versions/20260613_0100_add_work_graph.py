"""Add permission-safe Work Graph impact analysis tables.

Revision ID: 20260613_0100
Revises: 20260613_0099
Create Date: 2026-06-13
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects import postgresql

revision = "20260613_0100"
down_revision = "20260613_0099"
branch_labels = None
depends_on = None

IS_SUPER = "current_setting('app.is_superadmin', true) = 'true'"
CURRENT_GUILD = "NULLIF(current_setting('app.current_guild_id', true), '')::integer"
PAM_GUILD = "NULLIF(current_setting('app.pam_guild_id', true), '')::integer"
PAM_READ = "current_setting('app.pam_read', true) = 'true'"
PAM_WRITE = "current_setting('app.pam_write', true) = 'true'"

NODE_VALUES = "('initiative','project','task','subtask','document','comment','user','deadline','dependency','blocker','skill','deliverable','milestone','agent_step')"
EDGE_VALUES = "('depends_on','blocks','owned_by','assigned_to','mentions','documents','derived_from','contains','part_of','requires_skill','has_deadline','impacts','duplicates','conflicts_with','generated_by_agent')"


def _enable_rls(conn, table: str) -> None:
    conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
    conn.execute(text(f"CREATE POLICY guild_isolation ON {table} FOR ALL USING (guild_id = {CURRENT_GUILD} OR {IS_SUPER}) WITH CHECK (guild_id = {CURRENT_GUILD} OR {IS_SUPER})"))
    conn.execute(text(f"CREATE POLICY {table}_pam_read ON {table} FOR SELECT USING (guild_id = {PAM_GUILD} AND {PAM_READ})"))
    conn.execute(text(f"CREATE POLICY {table}_pam_write ON {table} FOR ALL USING (guild_id = {PAM_GUILD} AND {PAM_WRITE}) WITH CHECK (guild_id = {PAM_GUILD} AND {PAM_WRITE})"))


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(text(f"CREATE TYPE work_graph_node_type AS ENUM {NODE_VALUES}"))
    conn.execute(text(f"CREATE TYPE work_graph_edge_type AS ENUM {EDGE_VALUES}"))
    conn.execute(text("CREATE TYPE work_graph_blocker_severity AS ENUM ('low','medium','high','critical')"))
    conn.execute(text("CREATE TYPE work_graph_blocker_status AS ENUM ('open','resolved','ignored')"))

    op.create_table(
        "work_graph_nodes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("entity_type", postgresql.ENUM(name="work_graph_node_type", create_type=False), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=512), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=True),
        sa.Column("priority", sa.String(length=64), nullable=True),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("guild_id", "entity_type", "entity_id", name="uq_work_graph_node_entity"),
    )
    for name, cols in {
        "ix_work_graph_nodes_guild_id": ["guild_id"],
        "ix_work_graph_nodes_initiative_id": ["initiative_id"],
        "ix_work_graph_nodes_project_id": ["project_id"],
        "ix_work_graph_nodes_entity_type": ["entity_type"],
        "ix_work_graph_nodes_entity_id": ["entity_id"],
        "ix_work_graph_nodes_status": ["status"],
        "ix_work_graph_nodes_priority": ["priority"],
        "ix_work_graph_nodes_owner_user_id": ["owner_user_id"],
        "ix_work_graph_nodes_deadline_at": ["deadline_at"],
        "ix_work_graph_nodes_deleted_at": ["deleted_at"],
        "ix_work_graph_nodes_created_at": ["created_at"],
    }.items():
        op.create_index(name, "work_graph_nodes", cols)
    conn.execute(text("CREATE INDEX ix_work_graph_nodes_metadata ON work_graph_nodes USING gin(metadata)"))

    op.create_table(
        "work_graph_edges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=True),
        sa.Column("source_node_id", sa.Integer(), sa.ForeignKey("work_graph_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_node_id", sa.Integer(), sa.ForeignKey("work_graph_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("edge_type", postgresql.ENUM(name="work_graph_edge_type", create_type=False), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="1"),
        sa.Column("is_blocking", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("lag_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("guild_id", "source_node_id", "target_node_id", "edge_type", name="uq_work_graph_edge_identity"),
    )
    for name, cols in {
        "ix_work_graph_edges_guild_id": ["guild_id"],
        "ix_work_graph_edges_initiative_id": ["initiative_id"],
        "ix_work_graph_edges_source_node_id": ["source_node_id"],
        "ix_work_graph_edges_target_node_id": ["target_node_id"],
        "ix_work_graph_edges_edge_type": ["edge_type"],
        "ix_work_graph_edges_is_blocking": ["is_blocking"],
        "ix_work_graph_edges_deleted_at": ["deleted_at"],
        "ix_work_graph_edges_created_at": ["created_at"],
    }.items():
        op.create_index(name, "work_graph_edges", cols)
    conn.execute(text("CREATE INDEX ix_work_graph_edges_metadata ON work_graph_edges USING gin(metadata)"))

    op.create_table(
        "work_graph_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("graph_version", sa.String(length=128), nullable=False),
        sa.Column("node_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("edge_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=64), nullable=False, server_default="completed"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_work_graph_snapshots_guild_id", "work_graph_snapshots", ["guild_id"])
    op.create_index("ix_work_graph_snapshots_initiative_id", "work_graph_snapshots", ["initiative_id"])
    op.create_index("ix_work_graph_snapshots_project_id", "work_graph_snapshots", ["project_id"])
    op.create_index("ix_work_graph_snapshots_graph_version", "work_graph_snapshots", ["graph_version"])
    op.create_index("ix_work_graph_snapshots_status", "work_graph_snapshots", ["status"])
    op.create_index("ix_work_graph_snapshots_created_at", "work_graph_snapshots", ["created_at"])

    op.create_table(
        "work_graph_impact_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("start_node_id", sa.Integer(), sa.ForeignKey("work_graph_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("query_type", sa.String(length=64), nullable=False),
        sa.Column("traversal_depth", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("impacted_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("result", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for name, cols in {
        "ix_work_graph_impact_runs_guild_id": ["guild_id"],
        "ix_work_graph_impact_runs_initiative_id": ["initiative_id"],
        "ix_work_graph_impact_runs_project_id": ["project_id"],
        "ix_work_graph_impact_runs_user_id": ["user_id"],
        "ix_work_graph_impact_runs_start_node_id": ["start_node_id"],
        "ix_work_graph_impact_runs_query_type": ["query_type"],
        "ix_work_graph_impact_runs_created_at": ["created_at"],
    }.items():
        op.create_index(name, "work_graph_impact_runs", cols)

    op.create_table(
        "work_graph_risk_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("node_id", sa.Integer(), sa.ForeignKey("work_graph_nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("level", sa.String(length=32), nullable=False, server_default="low"),
        sa.Column("factors", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("guild_id", "node_id", name="uq_work_graph_risk_node"),
    )
    op.create_index("ix_work_graph_risk_scores_guild_id", "work_graph_risk_scores", ["guild_id"])
    op.create_index("ix_work_graph_risk_scores_initiative_id", "work_graph_risk_scores", ["initiative_id"])
    op.create_index("ix_work_graph_risk_scores_project_id", "work_graph_risk_scores", ["project_id"])
    op.create_index("ix_work_graph_risk_scores_node_id", "work_graph_risk_scores", ["node_id"])
    op.create_index("ix_work_graph_risk_scores_level", "work_graph_risk_scores", ["level"])
    op.create_index("ix_work_graph_risk_scores_updated_at", "work_graph_risk_scores", ["updated_at"])

    op.create_table(
        "work_graph_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="SET NULL"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("action_type", sa.String(length=128), nullable=False),
        sa.Column("before_state_hash", sa.String(length=64), nullable=True),
        sa.Column("after_state_hash", sa.String(length=64), nullable=True),
        sa.Column("traversal_depth", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("impacted_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("policy_decision", sa.String(length=64), nullable=False, server_default="allow"),
        sa.Column("payload", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for name, cols in {
        "ix_work_graph_audit_events_guild_id": ["guild_id"],
        "ix_work_graph_audit_events_initiative_id": ["initiative_id"],
        "ix_work_graph_audit_events_project_id": ["project_id"],
        "ix_work_graph_audit_events_user_id": ["user_id"],
        "ix_work_graph_audit_events_entity_id": ["entity_id"],
        "ix_work_graph_audit_events_action_type": ["action_type"],
        "ix_work_graph_audit_events_created_at": ["created_at"],
    }.items():
        op.create_index(name, "work_graph_audit_events", cols)

    op.create_table(
        "task_dependencies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("source_task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("lag_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("guild_id", "source_task_id", "target_task_id", name="uq_task_dependency_pair"),
    )
    op.create_index("ix_task_dependencies_guild_id", "task_dependencies", ["guild_id"])
    op.create_index("ix_task_dependencies_initiative_id", "task_dependencies", ["initiative_id"])
    op.create_index("ix_task_dependencies_project_id", "task_dependencies", ["project_id"])
    op.create_index("ix_task_dependencies_source_task_id", "task_dependencies", ["source_task_id"])
    op.create_index("ix_task_dependencies_target_task_id", "task_dependencies", ["target_task_id"])
    op.create_index("ix_task_dependencies_deleted_at", "task_dependencies", ["deleted_at"])

    op.create_table(
        "task_blockers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("severity", postgresql.ENUM(name="work_graph_blocker_severity", create_type=False), nullable=False, server_default="medium"),
        sa.Column("status", postgresql.ENUM(name="work_graph_blocker_status", create_type=False), nullable=False, server_default="open"),
        sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("linked_entity_type", sa.String(length=64), nullable=True),
        sa.Column("linked_entity_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_task_blockers_guild_id", "task_blockers", ["guild_id"])
    op.create_index("ix_task_blockers_initiative_id", "task_blockers", ["initiative_id"])
    op.create_index("ix_task_blockers_project_id", "task_blockers", ["project_id"])
    op.create_index("ix_task_blockers_task_id", "task_blockers", ["task_id"])
    op.create_index("ix_task_blockers_severity", "task_blockers", ["severity"])
    op.create_index("ix_task_blockers_status", "task_blockers", ["status"])
    op.create_index("ix_task_blockers_deleted_at", "task_blockers", ["deleted_at"])

    op.create_table(
        "skills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("guild_id", "name", name="uq_skill_guild_name"),
    )
    op.create_index("ix_skills_guild_id", "skills", ["guild_id"])
    op.create_index("ix_skills_name", "skills", ["name"])
    op.create_index("ix_skills_created_at", "skills", ["created_at"])
    op.create_index("ix_skills_deleted_at", "skills", ["deleted_at"])

    op.create_table(
        "user_skills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_id", sa.Integer(), sa.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("guild_id", "user_id", "skill_id", name="uq_user_skill"),
    )
    op.create_index("ix_user_skills_guild_id", "user_skills", ["guild_id"])
    op.create_index("ix_user_skills_user_id", "user_skills", ["user_id"])
    op.create_index("ix_user_skills_skill_id", "user_skills", ["skill_id"])

    op.create_table(
        "task_required_skills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("guild_id", sa.Integer(), sa.ForeignKey("guilds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("initiative_id", sa.Integer(), sa.ForeignKey("initiatives.id", ondelete="CASCADE"), nullable=True),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_id", sa.Integer(), sa.ForeignKey("skills.id", ondelete="CASCADE"), nullable=False),
        sa.Column("required_level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("guild_id", "task_id", "skill_id", name="uq_task_required_skill"),
    )
    op.create_index("ix_task_required_skills_guild_id", "task_required_skills", ["guild_id"])
    op.create_index("ix_task_required_skills_initiative_id", "task_required_skills", ["initiative_id"])
    op.create_index("ix_task_required_skills_project_id", "task_required_skills", ["project_id"])
    op.create_index("ix_task_required_skills_task_id", "task_required_skills", ["task_id"])
    op.create_index("ix_task_required_skills_skill_id", "task_required_skills", ["skill_id"])

    for table in (
        "work_graph_nodes", "work_graph_edges", "work_graph_snapshots", "work_graph_impact_runs",
        "work_graph_risk_scores", "work_graph_audit_events", "task_dependencies", "task_blockers",
        "skills", "user_skills", "task_required_skills",
    ):
        _enable_rls(conn, table)


def downgrade() -> None:
    conn = op.get_bind()
    for table in (
        "task_required_skills", "user_skills", "skills", "task_blockers", "task_dependencies",
        "work_graph_audit_events", "work_graph_risk_scores", "work_graph_impact_runs",
        "work_graph_snapshots", "work_graph_edges", "work_graph_nodes",
    ):
        conn.execute(text(f"DROP POLICY IF EXISTS {table}_pam_write ON {table}"))
        conn.execute(text(f"DROP POLICY IF EXISTS {table}_pam_read ON {table}"))
        conn.execute(text(f"DROP POLICY IF EXISTS guild_isolation ON {table}"))
        op.drop_table(table)
    conn.execute(text("DROP TYPE IF EXISTS work_graph_blocker_status"))
    conn.execute(text("DROP TYPE IF EXISTS work_graph_blocker_severity"))
    conn.execute(text("DROP TYPE IF EXISTS work_graph_edge_type"))
    conn.execute(text("DROP TYPE IF EXISTS work_graph_node_type"))
