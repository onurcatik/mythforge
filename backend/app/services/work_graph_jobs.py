from __future__ import annotations

from datetime import datetime, timezone
import logging

from sqlmodel import select

from app.db.session import AdminSessionLocal
from app.models.work_graph import WorkGraphSnapshot
from app.services import work_graph_sync

logger = logging.getLogger(__name__)
WORK_GRAPH_REBUILD_POLL_SECONDS = 20


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def enqueue_rebuild(
    session,
    *,
    guild_id: int,
    initiative_id: int | None = None,
    project_id: int | None = None,
    user_id: int | None = None,
    dry_run: bool = False,
) -> WorkGraphSnapshot:
    snapshot = WorkGraphSnapshot(
        guild_id=guild_id,
        initiative_id=initiative_id,
        project_id=project_id,
        graph_version=f"queued-rebuild-{int(_now().timestamp())}",
        node_count=0,
        edge_count=0,
        status="queued_dry_run" if dry_run else "queued",
        error=str(user_id or ""),
    )
    session.add(snapshot)
    await session.flush()
    return snapshot


async def process_work_graph_rebuild_jobs() -> None:
    async with AdminSessionLocal() as session:
        jobs = (
            await session.exec(
                select(WorkGraphSnapshot)
                .where(WorkGraphSnapshot.status.in_(("queued", "queued_dry_run")))
                .order_by(WorkGraphSnapshot.created_at.asc())
                .limit(3)
            )
        ).all()
        for job in jobs:
            try:
                dry_run = job.status == "queued_dry_run"
                job.status = "running"
                session.add(job)
                await session.commit()
                user_id = int(job.error or 0) or None
                nodes, edges, _snapshot = await work_graph_sync.rebuild_scope(
                    session,
                    guild_id=job.guild_id,
                    initiative_id=job.initiative_id,
                    project_id=job.project_id,
                    user_id=user_id,
                    dry_run=dry_run,
                )
                job.node_count = nodes
                job.edge_count = edges
                job.status = "completed"
                job.error = None
                session.add(job)
                await session.commit()
            except Exception as exc:  # pragma: no cover
                logger.exception("Work Graph rebuild job failed")
                job.status = "failed"
                job.error = str(exc)[:2000]
                session.add(job)
                await session.commit()
