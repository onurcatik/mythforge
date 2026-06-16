# Frontend Phase 8 QA Checklist

## Required commands

```bash
cd frontend
pnpm install
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
```

## Smoke routes

- Dashboard: workspace health, runtime readiness and quality gate panels render.
- Projects: project detail, project cockpit and work intelligence surfaces render.
- Tasks: task list, task detail, dependency/blocker and assignment surfaces render.
- Documents: document list/detail and knowledge operations surfaces render.
- AI Command Center: RAG, Agent, command result and approval-first surfaces render.
- Runtime Settings: provider, Ollama, local-only and health sections render.

## Accessibility checks

- Skip links appear on keyboard focus.
- Main content receives focus after skip link activation.
- Dialogs and drawers keep focus contained.
- Reduced-motion preference disables nonessential animation.
- High-contrast preference strengthens focus and border visibility.

## Responsive checks

- 1440px+: full density shell and optional right rail remain usable.
- 1280px: content cards do not overflow horizontally.
- 768px: navigation drawer and stacked intelligence cards remain usable.
- 390px: command, task and runtime settings flows remain touch-safe.

## Backend contract rule

Phase 8 is frontend-only. Any backend change request must be recorded as technical debt instead of patched into backend code.
