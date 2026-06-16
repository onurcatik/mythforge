<div align="center">
  <img src="frontend/public/icons/icon-48.webp" alt="MythForge" width="96" height="96" />
  <h1>MythForge</h1>
  <p><strong>Enterprise-grade AI-powered Collaborative Campaign & Project Management Platform for TTRPG</strong></p>

  <p>
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
    <img src="https://img.shields.io/badge/FastAPI-0.136-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" />
    <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind v4" />
    <img src="https://img.shields.io/badge/PostgreSQL-RLS-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
    <img src="https://img.shields.io/badge/Capacitor-8-119EFF?style=flat-square&logo=capacitor&logoColor=white" alt="Capacitor 8" />
    <img src="https://img.shields.io/badge/pnpm-11.5-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm" />
  </p>

  <p>
    <a href="#-overview">Overview</a> ·
    <a href="#%EF%B8%8F-system-architecture">Architecture</a> ·
    <a href="#-tech-stack">Tech Stack</a> ·
    <a href="#-getting-started">Getting Started</a> ·
    <a href="#-testing--quality-gates">Testing</a> ·
    <a href="#-mobile-capacitor">Mobile</a> ·
    <a href="#-environment-reference">Environment</a>
  </p>
</div>

---

## 🌌 Overview

**MythForge** is an enterprise-grade collaborative platform purpose-built for Tabletop Role-Playing Game (TTRPG) groups — Dungeon Masters, players, writers and game designers. It unifies campaign management, real-time document editing, AI-assisted lore search, and visual dependency mapping (Work Graph) in a single, security-first application.

Built on modern software engineering principles — **Feature-Sliced Design**, **PostgreSQL Row Level Security**, **Yjs CRDT real-time sync**, and **RAG AI workflows** — MythForge delivers a product experience normally reserved for enterprise project management tools, applied to the world of fantasy campaigns.

> **Key Design Principles:**
> - Backend contracts are stable; the frontend never defines or changes them.
> - Every AI write action is **approval-first** — no AI mutation runs without explicit user confirmation.
> - Local/cloud AI runtime state is visible without ever leaking secrets.
> - Server state lives in query hooks, not page components.
> - Permission-denied states are first-class product states, not generic error pages.

---

## 🏗️ System Architecture

The platform is composed of three runtime layers: a **Python async backend**, a **React SPA frontend**, and a **native mobile shell** via Capacitor — all communicating over a well-typed OpenAPI contract.

```mermaid
graph TB
    subgraph Mobile["📱 Mobile Layer (Capacitor 8)"]
        AND[Android Native Shell]
        IOS[iOS Native Shell]
    end

    subgraph Frontend["🖥️ Frontend Layer (React 19 + Vite 8)"]
        SPA[React SPA<br/>TanStack Router + Query]
        WS_CLIENT[Yjs WebSocket Client<br/>CRDT Real-time Sync]
        AI_UI[AI Command Center<br/>Approval-First UI]
    end

    subgraph Backend["⚙️ Backend Layer (FastAPI + Uvicorn)"]
        API[REST API v1<br/>FastAPI Routers]
        WS_SERVER[WebSocket Server<br/>pycrdt-websocket]
        AI_SVC[AI / RAG Service<br/>Ollama · Cloud LLM]
        RATE[SlowAPI Rate Limiter]
        BG[Background Tasks<br/>Notifications · Digests]
    end

    subgraph Database["🗄️ Database Layer (PostgreSQL)"]
        SUPER[("Superuser\nMigrations & Schema")]
        APP[("App User\nRLS-Enforced Queries")]
        ADMIN[("Admin User\nBYPASSRLS · Background Jobs")]
    end

    AND & IOS -->|capacitor bridge| SPA
    SPA -->|HTTP / Axios| API
    SPA -->|WebSocket| WS_SERVER
    AI_UI -->|RAG command| AI_SVC
    API --> RATE
    API -->|SQLModel ORM| APP
    BG -->|SQLModel ORM| ADMIN
    WS_SERVER -->|Alembic| SUPER
    API -.->|OpenAPI JSON| SPA
```

---

## 🔐 Database Security Model (PostgreSQL RLS)

MythForge enforces strict **per-guild data isolation** at the database layer using PostgreSQL Row Level Security policies. Three database roles are used — each with a different trust level.

```mermaid
flowchart LR
    subgraph roles["Database Roles"]
        SU["🔑 Superuser\n(DATABASE_URL)\nFull DDL access\nRuns Alembic migrations\nCreates RLS policies"]
        AU["👤 App User\n(DATABASE_URL_APP)\nRLS-enforced\nSELECT / INSERT / UPDATE / DELETE\nonly within own guild"]
        AD["🛡️ Admin User\n(DATABASE_URL_ADMIN)\nBYPASSRLS role\nBackground jobs\nNotification digests\nCron tasks"]
    end

    SU -->|"schema & RLS setup"| DB[("PostgreSQL\nforge DB")]
    AU -->|"row-level filtered\ndata access"| DB
    AD -->|"cross-guild\nadmin access"| DB
```

---

## 🧱 Frontend Architecture (Feature-Sliced Design)

The frontend follows **Feature-Sliced Design (FSD)** — a scalable, product-boundary-first architecture. Each layer may only depend on layers below it.

```mermaid
graph BT
    shared["🔩 shared\nUI primitives · API adapters\nDesign system · Config · Utils"]
    entities["🗃️ entities\nDomain models · Small domain UI\n(Task, Document, Guild, User…)"]
    features["⚡ features\nUser-action workflows\n(create task, run AI cmd, approve…)"]
    widgets["🧩 widgets\nReusable product blocks\n(Sidebar, Work Graph, Command Entry…)"]
    pages["📄 pages\nRoute-level screens\n(Dashboard, Project, Task Detail…)"]
    processes["🔀 processes\nMulti-step workflows\n(Onboarding, Approval flows…)"]
    app["🚀 app\nApp shell · Providers\nRouting · Global composition"]

    shared --> entities --> features --> widgets --> pages --> processes --> app
```

---

## 🔄 API Data Flow & Code Generation

TypeScript types and React Query hooks are **auto-generated** from the backend's live OpenAPI schema — ensuring the frontend client is always in sync with the backend contract.

```mermaid
sequenceDiagram
    participant BE as FastAPI Backend
    participant OP as openapi.json
    participant OR as Orval
    participant GEN as src/api/generated/
    participant UI as React Components

    BE->>OP: GET /api/v1/openapi.json
    OP->>OR: pnpm generate:api
    OR->>GEN: TypeScript types + React Query hooks
    GEN->>UI: Strongly-typed data access
    UI->>BE: Axios HTTP requests (type-safe)
    BE-->>UI: JSON responses (validated by Pydantic)
```

---

## 🚀 Development Startup Workflow

```mermaid
flowchart LR
    A["🐳 docker-compose\nup db -d --wait"] --> B["📦 dev-migrate.sh\nAlembic migrations\n+ init_db superuser"]
    B --> C["🌱 dev-seed.sh\nTTRPG seed data\n(guilds · users · tasks · docs)"]
    C --> D["⚙️ Backend\nuvicorn :8000\n--reload"]
    C --> E["🖥️ Frontend\nVite :5173\npnpm dev"]
    D & E --> F["🌐 Browser\nhttp://localhost:5173"]
```

---

## 🛠️ Tech Stack

### Backend

| Layer | Technology | Purpose |
|---|---|---|
| Web Framework | **FastAPI 0.136 + Uvicorn** | Async REST API & WebSocket server |
| ORM | **SQLModel + SQLAlchemy 2** | Type-safe, async database access |
| Database | **PostgreSQL 15+** | Relational store with native RLS policies |
| Migrations | **Alembic** | Schema versioning and upgrades |
| Real-time Sync | **pycrdt 0.13 + pycrdt-websocket 0.16** | Yjs CRDT over WebSocket for conflict-free collaborative editing |
| Auth | **PyJWT + argon2-cffi + bcrypt** | JWT tokens + secure password hashing |
| OIDC / SSO | **google-auth** | Optional OIDC / Google SSO provider |
| Rate Limiting | **SlowAPI 0.1** | IP-based request throttling |
| File Handling | **python-magic + python-multipart** | MIME detection and multipart uploads |
| Calendar | **icalendar** | iCal import/export for campaign events |
| HTML Security | **nh3** | Server-side HTML sanitisation |
| Testing | **pytest + pytest-asyncio + pytest-cov** | Async integration and unit tests |

### Frontend

| Layer | Technology | Purpose |
|---|---|---|
| UI Framework | **React 19 + Vite 8** | Component model + ESBuild-powered dev/build |
| Language | **TypeScript 6.0** | Full type safety across the codebase |
| Routing | **TanStack Router 1.170** | File-based, type-safe client routing |
| Server State | **TanStack Query 5** | Async data fetching, caching, mutations |
| Graph Canvas | **@xyflow/react 12** | Interactive Work Graph (tasks, blockers, dependencies) |
| Rich Text | **Lexical 0.45 + Yjs** | Collaborative rich-text editor with table support |
| Diagrams | **Excalidraw 0.18** | Embedded sketch/diagram canvas |
| Styling | **Tailwind CSS v4 + Tailwind Animate** | Utility-first responsive design system |
| UI Primitives | **Radix UI** | Accessible, headless component library |
| API Client | **Axios + Orval** | HTTP client + auto-generated typed hooks from OpenAPI |
| Drag & Drop | **@dnd-kit/core + sortable** | Kanban board and list reordering |
| Data Tables | **TanStack Table 8** | Virtualised, sortable data grids |
| Charts | **Recharts 3** | Dashboard analytics and progress charts |
| Icons | **Lucide React** | Consistent SVG icon library |
| Linting | **Biome 2** | Ultra-fast formatter + linter (replaces ESLint + Prettier) |
| Testing | **Vitest 4 + Testing Library** | Unit and component tests |

### Mobile (Capacitor)

| Plugin | Purpose |
|---|---|
| `@capacitor/push-notifications` | Firebase Cloud Messaging (FCM) push alerts |
| `@capacitor/haptics` | Tactile feedback on native touch |
| `@capacitor-community/safe-area` | Safe area insets for notched displays |
| `@capacitor/splash-screen` | Branded launch screen |
| `@capgo/capacitor-updater` | Over-the-air (OTA) JS bundle updates |
| `@capacitor/network` | Offline/online state detection |
| `@capacitor/preferences` | Persistent key-value native storage |

---

## 📁 Repository Structure

```text
mythforge/
├── backend/                        # Python async backend
│   ├── alembic/                    # Schema migration scripts
│   ├── app/
│   │   ├── api/v1/endpoints/       # REST endpoint modules (tasks, projects, guilds…)
│   │   ├── core/                   # Config, security, rate limiting, encryption
│   │   ├── db/                     # Session factory, RLS filter, init_db
│   │   ├── models/                 # SQLModel ORM table definitions
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   ├── services/               # Business logic (guilds, tasks, AI, notifications…)
│   │   └── main.py                 # FastAPI app factory & startup lifecycle
│   ├── .env.example                # Environment variable reference
│   ├── requirements.txt            # Python dependencies (pinned)
│   └── pyproject.toml              # Project metadata & Biome/pytest config
│
├── frontend/                       # React SPA client
│   ├── src/
│   │   ├── app/                    # App shell, providers, router bootstrap
│   │   ├── processes/              # Multi-step UX flows (onboarding, approval)
│   │   ├── pages/                  # Route-level screen components
│   │   ├── widgets/                # Standalone product blocks (Sidebar, Work Graph)
│   │   ├── features/               # User-action feature modules
│   │   ├── entities/               # Domain models and domain-specific UI helpers
│   │   ├── shared/                 # Design system, API adapters, utility functions
│   │   └── api/generated/          # Auto-generated TypeScript types & Query hooks
│   ├── public/icons/icon-48.webp   # Application icon
│   ├── android/                    # Capacitor Android native project
│   ├── ios/                        # Capacitor iOS native project
│   ├── package.json                # Node dependencies and npm scripts
│   ├── vite.config.ts              # Vite build configuration
│   ├── tailwind.config.ts          # Tailwind design token config
│   └── biome.jsonc                 # Biome linter/formatter ruleset
│
├── scripts/                        # Developer automation shell scripts
│   ├── dev-pre-launch.sh           # One-command full environment bootstrap
│   ├── dev-backend.sh              # Start uvicorn with --reload
│   ├── dev-frontend.sh             # Start Vite dev server
│   ├── dev-migrate.sh              # Run Alembic migrations + init_db
│   ├── dev-seed.sh                 # Seed TTRPG test data
│   ├── dev-cleanup.sh              # Tear down all background dev processes
│   └── seed_dev_data.py            # 1,000-task TTRPG dungeon data seeder
│
└── .vscode/tasks.json              # VS Code task definitions (db → migrate → seed → run)
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Docker** & Docker Compose | Latest | Runs the PostgreSQL dev database |
| **Python** | 3.10+ | Backend runtime |
| **Node.js** | 18+ | Frontend runtime |
| **pnpm** | 9+ (11.5.1 recommended) | Package manager (`corepack enable`) |
| **Ollama** | Latest | *Optional* — required only for local AI mode |

---

### Option A — One-Command Bootstrap (Recommended)

Run the full dev environment (DB → migrate → seed → backend → frontend → browser) from the repository root:

```bash
bash scripts/dev-pre-launch.sh
```

This script orchestrates the complete startup chain in sequence:

1. `docker-compose up db -d --wait` — starts PostgreSQL and waits until healthy
2. `scripts/dev-migrate.sh` — applies all Alembic migrations and creates the first superuser
3. `scripts/dev-seed.sh` — seeds TTRPG-themed data (guilds, characters, 1,000 dungeon tasks, documents, calendar events)
4. `scripts/dev-backend.sh` (background) — starts Uvicorn on **`http://localhost:8000`**
5. `scripts/dev-frontend.sh` (background) — starts Vite on **`http://localhost:5173`**
6. Opens the browser automatically after Vite is ready

To stop the entire environment and release all ports:

```bash
bash scripts/dev-cleanup.sh
```

---

### Option B — Manual Step-by-Step Setup

#### 1. Configure Environment Variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set the three required database URLs:

```ini
# Superuser — schema migrations and RLS policy creation
DATABASE_URL=postgresql+asyncpg://forge:forge@localhost:5432/forge

# Application user — RLS-enforced runtime queries
DATABASE_URL_APP=postgresql+asyncpg://app_user:app_user_password@localhost:5432/forge

# Admin user — BYPASSRLS for background jobs
DATABASE_URL_ADMIN=postgresql+asyncpg://app_admin:app_admin_password@localhost:5432/forge

SECRET_KEY=change-me-in-production
APP_URL=http://localhost:5173
```

#### 2. Start the Database

```bash
docker-compose up db -d --wait
```

#### 3. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
# .venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Run migrations and create first superuser
python -m app.db.init_db

# Seed TTRPG development data (optional but recommended)
python ../scripts/seed_dev_data.py

# Start the development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at **`http://localhost:8000`**  
Interactive API docs (Swagger UI): **`http://localhost:8000/api/v1/docs`**

#### 4. Frontend Setup

```bash
cd frontend

# Install Node dependencies
pnpm install

# Auto-generate TypeScript types and React Query hooks from the live OpenAPI spec
pnpm generate:api

# Start the Vite development server
pnpm dev
```

The frontend will be available at **`http://localhost:5173`**

---

## 🧪 Testing & Quality Gates

### Backend Tests

```bash
cd backend
source .venv/bin/activate

# Run full test suite with coverage
pytest

# Run only tests matching a pattern
pytest -k "test_auth"

# Generate HTML coverage report
pytest --cov=app --cov-report=html
```

### Frontend Quality Pipeline

```bash
cd frontend

# Static analysis (lint + format check)
pnpm check

# Auto-fix lint and format violations
pnpm check:fix

# TypeScript type-checking (no emit)
pnpm typecheck

# Run unit and component tests (Vitest)
pnpm test:run

# Watch mode for TDD
pnpm test

# Production build (validates bundle integrity)
pnpm build
```

> **Quality Gate Policy:** All of the following must pass on every commit:  
> `pnpm typecheck` → `pnpm lint` → `pnpm test:run` → `pnpm build`

### Smoke Route Checklist

| Route | Expected Surfaces |
|---|---|
| Dashboard | Workspace health, runtime readiness, quality gate panels |
| Projects | Project detail, cockpit, work intelligence |
| Tasks | Task list, detail, dependency/blocker, assignment |
| Documents | Document list, detail, knowledge operations |
| AI Command Center | RAG, agent, command result, approval-first panels |
| Runtime Settings | Provider config, Ollama, local-only, health status |

---

## 📱 Mobile (Capacitor)

The React SPA is packaged as a native Android and iOS app using Capacitor 8.

```bash
cd frontend

# Build and sync the Android project, then launch in emulator/device
pnpm cap:android

# Build and sync the iOS project, then launch in Simulator (requires macOS + Xcode)
pnpm cap:ios
```

## ⚙️ Environment Reference

### Backend (`backend/.env`)

| Variable | Default | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | — | ✅ | Superuser connection (migrations, RLS setup) |
| `DATABASE_URL_APP` | — | ✅ | Application user (RLS-enforced runtime) |
| `DATABASE_URL_ADMIN` | — | ✅ | Admin user (BYPASSRLS, background jobs) |
| `SECRET_KEY` | `change-me` | ✅ | JWT signing secret — **change in production** |
| `APP_URL` | `http://localhost:5173` | ✅ | Base URL for OIDC redirects and deep links |
| `CORS_ALLOWED_ORIGINS` | `*` | ⚠️ | Comma-separated allow-list — restrict in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | — | JWT token TTL (24 hours) |
| `ENABLE_PUBLIC_REGISTRATION` | `true` | — | Set `false` to require invite codes |
| `DISABLE_GUILD_CREATION` | `false` | — | Prevent non-admin users from creating guilds |
| `HIBP_CHECK_ENABLED` | `true` | — | HaveIBeenPwned breach check on registration |
| `BEHIND_PROXY` | `false` | — | Enable when running behind nginx / load balancer |
| `OIDC_ENABLED` | `false` | — | Enable OIDC / SSO provider |
| `SMTP_HOST` | — | — | SMTP relay for email notifications |
| `FCM_ENABLED` | `false` | — | Firebase Cloud Messaging for mobile push |
| `CAPTCHA_PROVIDER` | — | — | `hcaptcha`, `turnstile`, or `recaptcha` (v2) |
| `FIRST_SUPERUSER_EMAIL` | `admin@example.com` | ✅ | Bootstrap admin account email |
| `FIRST_SUPERUSER_PASSWORD` | `changeme` | ✅ | Bootstrap admin account password |

---

## 🤝 Contributing

1. **Branch** off `main` using the convention `feat/<scope>`, `fix/<scope>`, or `chore/<scope>`.
2. **Write tests** — new features require Pytest tests (backend) and Vitest tests (frontend).
3. **Pass quality gates** — `pnpm check && pnpm typecheck && pnpm test:run` must succeed.
4. **Respect backend contracts** — frontend changes must not modify backend schemas or migrations.
5. **Approval-first for AI** — any AI-triggered write action must flow through the approval mechanism.
6. Submit a Pull Request with a clear description of the change, the motivation, and any linked issues.

---

