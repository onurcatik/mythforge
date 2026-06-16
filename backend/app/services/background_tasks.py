from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


async def _loop_worker(task_coro, interval: int, name: str) -> None:
    logger.info("%s worker started (interval=%ss)", name, interval)
    try:
        while True:
            try:
                await task_coro()
            except Exception:  # pragma: no cover
                logger.exception("%s worker encountered an error", name)
            await asyncio.sleep(interval)
    except asyncio.CancelledError:  # pragma: no cover
        logger.info("%s worker cancelled", name)
        raise


def start_background_tasks() -> list[asyncio.Task]:
    from app.services.notifications import (
        process_task_assignment_digests,
        process_overdue_notifications,
        process_event_reminders,
        DIGEST_POLL_SECONDS,
        OVERDUE_POLL_SECONDS,
        EVENT_REMINDER_POLL_SECONDS,
    )
    from app.services.oidc_refresh import process_oidc_refresh_sync, OIDC_SYNC_POLL_SECONDS
    from app.services.trash_purge import process_trash_purges, PURGE_POLL_SECONDS
    from app.services.rag_indexing import process_rag_index_jobs, RAG_INDEX_POLL_SECONDS
    from app.services.work_graph_jobs import process_work_graph_rebuild_jobs, WORK_GRAPH_REBUILD_POLL_SECONDS

    return [
        asyncio.create_task(
            _loop_worker(process_task_assignment_digests, DIGEST_POLL_SECONDS, "task-digest")
        ),
        asyncio.create_task(
            _loop_worker(process_overdue_notifications, OVERDUE_POLL_SECONDS, "overdue-digest")
        ),
        asyncio.create_task(
            _loop_worker(
                process_event_reminders, EVENT_REMINDER_POLL_SECONDS, "event-reminder"
            )
        ),
        asyncio.create_task(
            _loop_worker(process_oidc_refresh_sync, OIDC_SYNC_POLL_SECONDS, "oidc-refresh-sync")
        ),
        asyncio.create_task(
            _loop_worker(process_trash_purges, PURGE_POLL_SECONDS, "trash-purge")
        ),
        asyncio.create_task(
            _loop_worker(process_rag_index_jobs, RAG_INDEX_POLL_SECONDS, "rag-index")
        ),
        asyncio.create_task(
            _loop_worker(process_work_graph_rebuild_jobs, WORK_GRAPH_REBUILD_POLL_SECONDS, "work-graph-rebuild")
        ),
    ]
