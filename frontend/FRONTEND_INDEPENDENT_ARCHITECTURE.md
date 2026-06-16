# Independent Frontend Architecture

The independent frontend is organized around product boundaries instead of legacy component folders.

## Layers

- `src/app`: app shell, providers, routing integration and global app-level composition.
- `src/processes`: multi-step product workflows such as onboarding and approval flows.
- `src/pages`: route-level screens.
- `src/widgets`: reusable product blocks such as navigation, runtime status and command entry.
- `src/features`: user actions and feature workflows.
- `src/entities`: domain models and small domain-specific UI helpers.
- `src/shared`: design system, UI primitives, API adapters, config and utility functions.

## Design principles

1. Backend contracts are stable and must not be changed by the frontend rebuild.
2. UI models and API DTOs should remain separate.
3. Server state belongs in query hooks, not page components.
4. Every AI write action must remain approval-first.
5. Local/cloud AI runtime state must be visible without leaking secrets.
6. Permission-denied states are product states, not generic failures.
7. Dense project data must remain scannable and keyboard-friendly.
8. Old frontend components can be referenced for behavior but not copied for visual structure.

## Phase sequence

1. Design system and independent architecture foundation.
2. App shell, navigation and route integration.
3. Dashboard and onboarding.
4. Project, task and document screens.
5. AI Command Center, RAG and Agent experience.
6. Work Graph, assignment, dependency and blocker UI.
7. AI Runtime Settings, Ollama and Local AI Mode.
8. Responsive, accessibility, performance and QA.

## Phase 8 quality gates

Phase 8 does not change backend contracts. It closes the independent frontend with install-time quality gates and UI-level hardening:

- Run `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test:run` and `pnpm build` in the real frontend environment.
- Verify dashboard, project detail, task detail, documents, AI Command Center, Work Graph, Assignment and Runtime Settings routes after build.
- Test desktop `1440px+`, laptop `1280px`, tablet `768px` and mobile `390px` layouts.
- Validate keyboard access for command entry, navigation, approval flows, dialogs, drawers and skip links.
- Verify Local AI/Ollama runtime badges never expose secrets or cloud fallback while local-only is active.
- Treat `node_modules`-dependent failures in this sandbox as environment blockers, not product success.
