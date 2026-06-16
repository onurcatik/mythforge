<div align="center">
  <img src="frontend/public/icons/icon-48.webp" alt="MythForge" width="100" height="100" />

  <h1>MythForge</h1>

  <p>
    <strong>The professional campaign command platform for Tabletop RPG teams.</strong><br/>
    Real-time collaboration · AI-assisted lore search · Visual work graphs Enterprise security.
  </p>

  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19"/>
    <img src="https://img.shields.io/badge/FastAPI-0.136-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI"/>
    <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 6"/>
    <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind v4"/>
    <img src="https://img.shields.io/badge/PostgreSQL-RLS-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL RLS"/>
    <img src="https://img.shields.io/badge/Capacitor-8-119EFF?style=flat-square&logo=capacitor&logoColor=white" alt="Capacitor 8"/>
    <img src="https://img.shields.io/badge/License-Proprietary-red?style=flat-square" alt="Proprietary"/>
  </p>

  <p>
    <a href="#-product-overview">Product</a> ·
    <a href="#-core-capabilities">Capabilities</a> ·
    <a href="#-system-architecture">Architecture</a> ·
    <a href="#-tech-stack">Stack</a> ·
    <a href="#-getting-started">Get Started</a> ·
    <a href="#-testing--quality-gates">Quality</a> ·
    <a href="#-environment-reference">Config</a> ·
    <a href="#-roadmap">Roadmap</a>
  </p>
</div>

---

## 🎯 Product Overview

TTRPG groups — from hobbyist duos to professional design studios — manage campaigns, lore wikis, task queues, and player calendars across a fragmented mix of spreadsheets, Discord threads, and note apps. **MythForge** replaces that friction with a single, purpose-built command platform.

| Without MythForge | With MythForge |
|---|---|
| Campaign notes scattered across five tools | Unified rich-text wiki with real-time co-editing |
| "Who's doing what?" in Discord pings | Task board with assignees, blockers, and Work Graph |
| Lore searches done by scrolling through PDFs | RAG AI that answers from your own documents |
| No audit trail on AI suggestions | Approval-first: every AI write action requires explicit sign-off |
| Spreadsheets for XP, gold, and counters | Dynamic custom properties on any task, document, or event |
| iOS and Android left behind | One codebase → native Android + iOS via Capacitor |

MythForge is production-ready software engineered to enterprise standards: PostgreSQL Row Level Security for per-guild data isolation, Yjs CRDT for conflict-free collaborative editing, and a fully typed API contract shared between backend and frontend.

---

## ✨ Core Capabilities

### 🏰 Guild-Based Multi-Tenancy
Campaigns, users, and data are partitioned into **Guilds**. Each guild is a fully isolated workspace enforced at the database level — not the application level. Members only ever see data they are authorised to see.

### 📋 Projects, Tasks & Work Graph
Manage campaign quests, dungeon design phases, and writing sprints as projects with full task lifecycle support: priorities, custom statuses, assignees, subtasks, due dates, and start dates. The interactive **Work Graph** (powered by React Flow) visualises task dependencies, blockers, and the critical path in real time.

### 📝 Collaborative Documents & Spreadsheets
An embedded **Lexical rich-text editor** with Yjs CRDT synchronisation lets multiple users edit the same lore document simultaneously with zero conflicts. Spreadsheet views with ExcelJS and formula support are available for stat tables and campaign tracking.

### 🤖 AI Command Center
Plug in a local **Ollama** model or a cloud LLM to power:
- **RAG (Retrieval-Augmented Generation)** — answer questions from your own lore and documents.
- **Agent plans** — multi-step AI task execution surfaced as reviewable action plans.
- **Approval-first mutations** — every AI-suggested write is presented for human sign-off before execution. No silent side-effects.

### 📊 Initiatives & Queues
Group projects under **Initiatives** for high-level campaign arcs or product milestones. **Queues** provide ordered backlogs with priority, tagging, and role-based permissions for structured triage workflows.

### 🔢 Counters & Custom Properties
Track any numeric value — hit points, gold pieces, XP totals, room counts — with real-time **Counter groups**. Attach fully typed **Custom Properties** (text, number, date, select, multi-select) to tasks, documents, and calendar events without schema changes.

### 📅 Calendar & iCal Integration
Schedule sessions, encounters, and deadlines on an integrated campaign calendar. Import and export events as standard **iCal** (.ics) files for two-way sync with external calendar apps.

### 🔐 Authentication & SSO
- JWT-based session management with secure argon2/bcrypt password hashing.
- Optional **OIDC / Google SSO** for organisations that require federated identity.
- HaveIBeenPwned breach check on registration (k-anonymity, no full hash sent).
- CAPTCHA support (hCaptcha, Cloudflare Turnstile, reCAPTCHA v2).



---

## 🏗️ System Architecture

MythForge is a three-layer system: a Python async API backend, a React SPA frontend. All layers communicate over a versioned, typed OpenAPI contract.

```mermaid
graph TB
    subgraph Mobile["📱 Mobile  ·  Capacitor 8"]
        AND["Android"]
        IOS["iOS"]
    end

    subgraph Frontend["🖥️  Frontend  ·  React 19 + Vite 8"]
        direction LR
        SPA["SPA Shell\nTanStack Router + Query"]
        CRDT_C["Yjs WebSocket Client\nCRDT Real-time Sync"]
        AI_UI["AI Command Center\nApproval-First UI"]
    end

    subgraph Backend["⚙️  Backend  ·  FastAPI + Uvicorn"]
        direction LR
        API["REST API v1\n/api/v1/…"]
        WS["WebSocket\npycrdt-websocket"]
        AI["AI / RAG Service\nOllama · Cloud LLM"]
        RL["SlowAPI\nRate Limiter"]
        BG["Background Tasks\nNotifications · Digests"]
    end

    subgraph DB["🗄️  PostgreSQL  ·  Row Level Security"]
        SU[("Superuser\nMigrations & DDL")]
        APP[("App User\nRLS-Filtered Reads/Writes")]
        ADM[("Admin User\nBYPASSRLS · Cron Jobs")]
    end

    AND & IOS -->|"Capacitor bridge"| SPA
    SPA -->|"HTTP / Axios"| API
    SPA -->|"WebSocket"| WS
    AI_UI -->|"RAG / Agent command"| AI
    API --> RL
    API -->|"SQLModel async ORM"| APP
    BG -->|"SQLModel async ORM"| ADM
    WS -->|"pycrdt sessions"| APP
    WS -. "Alembic migrations" .-> SU
    API -. "OpenAPI JSON\n(auto-generates TS client)" .-> SPA
```

---

## 🔐 Database Security Model

Data isolation is enforced at the **PostgreSQL level** via Row Level Security policies — not in application code. Three roles with different trust levels are required.

```mermaid
flowchart LR
    SU["🔑 Superuser\nDATABASE_URL\n─────────────\nFull DDL rights\nRuns Alembic migrations\nCreates tables & RLS policies\nNever used by the app at runtime"]
    APP["👤 App User\nDATABASE_URL_APP\n─────────────\nRLS-enforced\nCan only read/write rows\nbelonging to the current guild\nUsed by all API requests"]
    ADM["🛡️ Admin User\nDATABASE_URL_ADMIN\n─────────────\nBYPASSRLS privilege\nUsed by background tasks\nnotification digests &\nscheduled cron jobs"]

    SU -->|"schema setup"| PG[("PostgreSQL\nforge database")]
    APP -->|"per-guild\nrow-filtered access"| PG
    ADM -->|"cross-guild\nadmin access"| PG
```

> **Security posture:** Application code never holds a superuser connection at runtime. The App User cannot read another guild's rows even if it constructs a direct SQL query — the RLS policy rejects it unconditionally.

---

## 🧱 Frontend Architecture (Feature-Sliced Design)

The client follows **Feature-Sliced Design (FSD)** — each layer may only import from layers below it. This eliminates circular dependencies and keeps domain logic strictly separated from UI rendering.

```mermaid
graph TB
    APP["🚀 app\nApp shell · Providers · Router bootstrap"]
    PROC["🔀 processes\nMulti-step flows — Onboarding · Approval"]
    PAGES["📄 pages\nRoute-level screens — Dashboard · Projects · Tasks · Documents · Settings"]
    WIDGETS["🧩 widgets\nWork Graph · AI Rail · Command Launcher · Navigation · Dashboard Panels"]
    FEAT["⚡ features\nCreate task · Run AI command · Approve action · Assign member"]
    ENT["🗃️ entities\nTask · Document · Guild · User · Counter · Initiative"]
    SHARED["🔩 shared\nDesign system · API adapters · Utility libs · Config"]

    APP --> PROC --> PAGES --> WIDGETS --> FEAT --> ENT --> SHARED
```

**Widget inventory** (from `frontend/src/widgets/`):

| Widget Module | Responsibility |
|---|---|
| `dashboard/` | Executive signal grid, momentum board, risk & capacity, AI operating plan panel |
| `work-intelligence/` | Work Graph control tower, dependency & blocker studio, assignment decision panel |
| `ai-operations/` | AI operation rail, RAG answer experience, agent plan experience, command result renderer |
| `ai-runtime/` | Runtime control tower, capability card, readiness launch card, status badge |
| `command-entry/` | Command launcher overlay |
| `quality/` | Frontend quality gate panel |

---

## 🔄 Type-Safe API Contract

TypeScript types and React Query hooks are **auto-generated** from the live OpenAPI schema. The frontend never hand-codes HTTP responses — the type system enforces contract correctness at compile time.

```mermaid
sequenceDiagram
    participant BE  as FastAPI Backend
    participant OA  as /api/v1/openapi.json
    participant OV  as Orval (pnpm generate:api)
    participant GEN as src/api/generated/
    participant UI  as React Components

    BE  ->> OA  : Serves OpenAPI spec on startup
    OA  ->> OV  : pnpm generate:api (fetches spec)
    OV  ->> GEN : Emits TypeScript types + React Query hooks
    GEN ->> UI  : Strongly-typed data layer (no manual DTOs)
    UI  ->> BE  : Axios requests (fully typed parameters & bodies)
    BE -->> UI  : Pydantic-validated JSON responses
```

---

## 🛠️ Tech Stack

### Backend

| Layer | Technology | Version |
|---|---|---|
| Web framework | FastAPI + Uvicorn | 0.136 / 0.41 |
| ORM | SQLModel + SQLAlchemy (async) | 0.0.38 / 2.0 |
| Database | PostgreSQL with native RLS | 15+ |
| Migrations | Alembic | 1.18 |
| Real-time sync | pycrdt + pycrdt-websocket | 0.13 / 0.16 |
| Auth | PyJWT + argon2-cffi + bcrypt | — |
| SSO | google-auth (OIDC) | 2.23+ |
| Rate limiting | SlowAPI | 0.1 |
| File uploads | python-magic + python-multipart | — |
| Calendar | icalendar | 6.0+ |
| HTML sanitisation | nh3 | 0.3 |
| Testing | pytest + pytest-asyncio + pytest-cov | — |

### Frontend

| Layer | Technology | Version |
|---|---|---|
| UI framework | React + Vite | 19 / 8 |
| Language | TypeScript | 6.0 |
| Routing | TanStack Router | 1.170 |
| Server state | TanStack Query | 5.100 |
| Graph canvas | @xyflow/react (React Flow) | 12.11 |
| Rich text | Lexical + @lexical/yjs | 0.45 |
| Diagrams | Excalidraw | 0.18 |
| Styling | Tailwind CSS v4 + Tailwind Animate | 4.3 |
| UI primitives | Radix UI (full suite) | — |
| API client | Axios + Orval (OpenAPI → hooks) | 1.17 / 8.15 |
| Tables | TanStack Table | 8.21 |
| Charts | Recharts | 3.8 |
| Drag & drop | @dnd-kit/core + sortable | 6.3 / 10.0 |
| Linting | Biome | 2.4 |
| Testing | Vitest + Testing Library | 4.1 |



---

## 📁 Repository Structure

```
mythforge/
├── backend/
│   ├── alembic/                   ← Schema migration scripts (versioned)
│   └── app/
│       ├── api/v1/endpoints/      ← One module per domain (tasks, projects, guilds, AI…)
│       ├── core/                  ← Config, security, encryption, rate limiting
│       ├── db/                    ← Session factory, RLS soft-delete filter, init_db
│       ├── models/                ← SQLModel table definitions (36 domain models)
│       ├── schemas/               ← Pydantic request / response schemas
│       ├── services/              ← Business logic layer (guilds, AI, notifications…)
│       └── main.py                ← FastAPI app factory, middleware, startup lifecycle
│
├── frontend/
│   └── src/
│       ├── app/                   ← App shell, providers, router bootstrap
│       ├── processes/             ← Multi-step UX flows (onboarding, approval)
│       ├── pages/                 ← Route-level screen components
│       ├── widgets/               ← Self-contained product blocks (9 widget modules)
│       ├── features/              ← User-action feature modules
│       ├── entities/              ← Domain models and domain UI helpers
│       ├── shared/                ← Design system, API adapters, utility functions
│       └── api/generated/         ← Auto-generated TypeScript types & Query hooks
│
└── scripts/
    ├── dev-pre-launch.sh          ← One-command full environment bootstrap
    ├── dev-backend.sh             ← Uvicorn --reload on :8000
    ├── dev-frontend.sh            ← Vite dev server on :5173
    ├── dev-migrate.sh             ← Alembic + init_db superuser
    ├── dev-seed.sh                ← TTRPG seed data (guilds, tasks, documents)
    ├── dev-cleanup.sh             ← Tear down all background processes
    └── seed_dev_data.py           ← 1,000-task dungeon seeder (deterministic)
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Docker + Docker Compose | Latest | PostgreSQL dev database |
| Python | 3.10 + | Backend runtime |
| Node.js | 18 + | Frontend runtime |
| pnpm | 11.5.1 (recommended) | Package manager — `corepack enable` |
| Ollama | Latest | *Optional* — local AI inference |

---

### Quick Start (One Command)

```bash
# Clone and enter the repository
git clone https://github.com/onurcatik/mythforge.git
cd mythforge

# Bootstrap the full dev environment:
# PostgreSQL → Alembic migrations → TTRPG seed data → backend → frontend → browser
bash scripts/dev-pre-launch.sh
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/api/v1/docs |

Default credentials created by the seeder:

```
Email:    admin@example.com
Password: changeme
```

To stop all services and release ports:

```bash
bash scripts/dev-cleanup.sh
```

---

### Manual Setup

<details>
<summary><strong>Step 1 — Configure environment</strong></summary>

```bash
cp backend/.env.example backend/.env
```

Set the three required database connection strings in `backend/.env`:

```ini
# Superuser — runs migrations and creates RLS policies (not used at runtime)
DATABASE_URL=postgresql+asyncpg://forge:forge@localhost:5432/forge

# Application user — RLS-enforced, used by all API requests
DATABASE_URL_APP=postgresql+asyncpg://app_user:app_user_password@localhost:5432/forge

# Admin user — BYPASSRLS, used by background tasks and cron jobs
DATABASE_URL_ADMIN=postgresql+asyncpg://app_admin:app_admin_password@localhost:5432/forge

SECRET_KEY=change-me-before-production
APP_URL=http://localhost:5173
```

</details>

<details>
<summary><strong>Step 2 — Start the database</strong></summary>

```bash
docker-compose up db -d --wait
```

</details>

<details>
<summary><strong>Step 3 — Backend</strong></summary>

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows

pip install -r requirements.txt
python -m app.db.init_db         # Migrations + first superuser
python ../scripts/seed_dev_data.py  # TTRPG seed data (optional)

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

</details>

<details>
<summary><strong>Step 4 — Frontend</strong></summary>

```bash
cd frontend
pnpm install
pnpm generate:api   # Auto-generate TypeScript client from live OpenAPI spec
pnpm dev
```

</details>

---

## 🧪 Testing & Quality Gates

### Quality Gate Policy

Every commit must pass the full pipeline before merge:

```
pnpm typecheck  →  pnpm lint  →  pnpm test:run  →  pnpm build
```

### Backend

```bash
cd backend && source .venv/bin/activate

pytest                                        # Full test suite
pytest -k "test_auth"                         # Run by keyword
pytest --cov=app --cov-report=html            # HTML coverage report
```

### Frontend

```bash
cd frontend

pnpm typecheck     # TypeScript — zero errors required
pnpm lint          # Biome static analysis
pnpm check:fix     # Auto-fix violations
pnpm test:run      # Vitest — all tests must pass
pnpm build         # Production bundle — must compile clean
```

### Route Smoke Tests

| Screen | Critical Surfaces |
|---|---|
| **Dashboard** | Executive signal grid, AI operating plan, project momentum board |
| **Projects** | Project detail, cockpit panels, work intelligence |
| **Tasks** | Task list, task detail, dependency & blocker graph, assignment panel |
| **Documents** | Document list, collaborative rich-text editor, spreadsheet view |
| **AI Command Center** | RAG answer experience, agent plan view, approval-first action surface |
| **Runtime Settings** | Provider config, Ollama local mode, health status badge |
| **Initiatives** | Initiative detail, linked projects, progress tracking |
| **Queues** | Queue list, ordered backlog, priority triage |
| **Counters** | Counter group dashboard, real-time value updates |
| **Calendar** | Month/week views, iCal import/export, RSVP management |

### Responsive Breakpoints

| Breakpoint | Target |
|---|---|
| 1440px + | Full-density shell with optional right rail |
| 1280px | No horizontal overflow on content cards |
| 768px | Navigation drawer and stacked intelligence cards usable |
| 390px | Command, task, and settings flows touch-safe |

---


## ⚙️ Environment Reference

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | — | ✅ | Superuser — DDL, migrations, RLS setup |
| `DATABASE_URL_APP` | — | ✅ | App user — RLS-enforced runtime queries |
| `DATABASE_URL_ADMIN` | — | ✅ | Admin user — BYPASSRLS, background jobs |
| `SECRET_KEY` | `change-me` | ✅ | JWT signing key — rotate in production |
| `APP_URL` | `http://localhost:5173` | ✅ | Base URL for OIDC redirects and deep links |
| `CORS_ALLOWED_ORIGINS` | `*` | ⚠️ | Restrict to your domain(s) in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | — | JWT TTL (default: 24 hours) |
| `ENABLE_PUBLIC_REGISTRATION` | `true` | — | `false` = invite-code only |
| `DISABLE_GUILD_CREATION` | `false` | — | Restrict guild creation to superusers |
| `HIBP_CHECK_ENABLED` | `true` | — | HaveIBeenPwned breach check on signup |
| `BEHIND_PROXY` | `false` | — | Enable when behind nginx / load balancer |
| `OIDC_ENABLED` | `false` | — | Enable federated OIDC / SSO |
| `SMTP_HOST` | — | — | SMTP relay for transactional email |
| `FCM_ENABLED` | `false` | — | Firebase Cloud Messaging for mobile push |
| `CAPTCHA_PROVIDER` | — | — | `hcaptcha` · `turnstile` · `recaptcha` |
| `FIRST_SUPERUSER_EMAIL` | `admin@example.com` | ✅ | Bootstrap superuser email |
| `FIRST_SUPERUSER_PASSWORD` | `changeme` | ✅ | Bootstrap superuser password |

---

## 🗺️ Roadmap

```mermaid
gantt
    title MythForge — Product Roadmap
    dateFormat YYYY-MM
    section Foundation
        Design system & FSD architecture     :done,    f1, 2025-01, 2025-02
        App shell, navigation, routing        :done,    f2, 2025-02, 2025-03
    section Core Product
        Dashboard & onboarding                :done,    c1, 2025-03, 2025-04
        Projects, tasks & documents           :done,    c2, 2025-04, 2025-06
        AI Command Center (RAG + Agent)       :done,    c3, 2025-06, 2025-08
        Work Graph, assignments & blockers    :done,    c4, 2025-08, 2025-10
        AI Runtime Settings (Ollama)          :done,    c5, 2025-10, 2025-11
        Responsive, accessibility & QA        :done,    c6, 2025-11, 2025-12
    section Growth
        Multi-language i18n (i18next)         :active,  g1, 2026-01, 2026-03
        Public API + webhook subscriptions    :         g2, 2026-03, 2026-05
        Plugin / extension marketplace        :         g3, 2026-05, 2026-09
    section Scale
        Self-hosted enterprise packaging      :         s1, 2026-09, 2026-12
        Advanced analytics & reporting        :         s2, 2026-10, 2027-02
```

---

## 🤝 Contributing

We welcome pull requests that improve quality, fix bugs, or add well-scoped features.

1. **Branch convention** — use `feat/<scope>`, `fix/<scope>`, or `chore/<scope>` branched from `main`.
2. **Tests are required** — backend changes need Pytest coverage; frontend changes need Vitest coverage.
3. **Quality gate** — `pnpm check && pnpm typecheck && pnpm test:run && pnpm build` must all pass.
4. **Contract stability** — frontend changes must never modify backend schemas, models, or migrations.
5. **Approval-first rule** — any AI-triggered write must route through the approval mechanism; no silent mutations.
6. Open a pull request with a concise description, the problem being solved, and any linked issues.

---

## 📜 License

Copyright © 2025 MythForge. All rights reserved.

This software is proprietary. Redistribution, modification, or commercial use without explicit written permission from the copyright holder is prohibited.
