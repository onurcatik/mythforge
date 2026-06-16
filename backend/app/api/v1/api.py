from fastapi import APIRouter

from app.api.v1.endpoints import (
    access_grants,
    admin,
    agent,
    ai_settings,
    assignments,
    attachments,
    auth,
    auto_subscriptions,
    blockers,
    calendar_events,
    collaboration,
    command,
    comments,
    config,
    counters,
    dependencies,
    documents,
    events,
    guilds,
    imports,
    initiatives,
    native,
    notifications,
    projects,
    property_definitions,
    push,
    queues,
    rag,
    recents,
    settings,
    tags,
    task_statuses,
    tasks,
    trash,
    user_view_preferences,
    users,
    version,
    work_graph,
)

api_router = APIRouter()
api_router.include_router(version.router, tags=["version"])
api_router.include_router(native.router, tags=["native"])
api_router.include_router(config.router, tags=["config"])
api_router.include_router(auto_subscriptions.router, prefix="/auto", tags=["auto"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(
    access_grants.router, prefix="/access-grants", tags=["access-grants"]
)
api_router.include_router(guilds.router, prefix="/guilds", tags=["guilds"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(task_statuses.router, tags=["task-statuses"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(tasks.subtasks_router, tags=["subtasks"])
api_router.include_router(comments.router, prefix="/comments", tags=["comments"])
api_router.include_router(
    notifications.router, prefix="/notifications", tags=["notifications"]
)
api_router.include_router(push.router, prefix="/push", tags=["push"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(ai_settings.router, prefix="/settings", tags=["ai-settings"])
api_router.include_router(initiatives.router, prefix="/initiatives", tags=["initiatives"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(
    attachments.router, prefix="/attachments", tags=["attachments"]
)
api_router.include_router(imports.router, prefix="/imports", tags=["imports"])
api_router.include_router(
    collaboration.router, prefix="/collaboration", tags=["collaboration"]
)
api_router.include_router(queues.router, prefix="/queues", tags=["queues"])
api_router.include_router(rag.router, prefix="/rag", tags=["rag"])
api_router.include_router(agent.router, prefix="/agent", tags=["agent"])
api_router.include_router(work_graph.router, prefix="/work-graph", tags=["work-graph"])
api_router.include_router(
    assignments.router, prefix="/assignments", tags=["assignments"]
)
api_router.include_router(command.router, prefix="/command", tags=["command"])
api_router.include_router(
    dependencies.router, prefix="/dependencies", tags=["dependencies"]
)
api_router.include_router(blockers.router, prefix="/blockers", tags=["blockers"])
api_router.include_router(counters.router, prefix="/counter-groups", tags=["counters"])
api_router.include_router(
    calendar_events.router, prefix="/calendar-events", tags=["calendar-events"]
)
api_router.include_router(tags.router, prefix="/tags", tags=["tags"])
api_router.include_router(
    property_definitions.router,
    prefix="/property-definitions",
    tags=["property-definitions"],
)
api_router.include_router(trash.router, prefix="/trash", tags=["trash"])
api_router.include_router(recents.router, prefix="/recents", tags=["recents"])
api_router.include_router(
    user_view_preferences.router,
    prefix="/user-view-preferences",
    tags=["user-view-preferences"],
)
