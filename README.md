# Darukaa.Earth

Darukaa.Earth is a full-stack geospatial dashboard for managing carbon and biodiversity projects.
Administrators create projects, add geographically bounded sites, and review environmental performance over time.

> Current release status: Phase 2 complete. Phase 3 site mapping is next.

## Product overview

The MVP solves three workflows:

1. **Authenticate** — register, sign in, and sign out securely.
2. **Manage projects** — create projects and view only owned projects.
3. **Map and measure sites** — draw site polygons, calculate area, and review carbon and biodiversity metrics.

The product specification is in [`docs/PROJECT-SPEC.md`](docs/PROJECT-SPEC.md). Implementation conventions are in [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md). Delivery progress and task checkboxes are in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Current progress

- Phase 0 — repository, tooling, local database, hooks, and CI: **complete**
- Phase 1 — JWT authentication API and UI: **complete**
- Phase 2 — project creation, listing, and ownership isolation: **complete**
- Phase 3 — PostGIS sites and Mapbox polygon drawing: **next**
- Phase 4 — seeded metrics and analytics chart: **planned**
- Phase 5 — deployment, submission document, and final QA: **planned**

## Architecture

```text
React + TypeScript + Vite
        |
        | REST + JWT
        v
FastAPI + SQLAlchemy
        |
        v
PostgreSQL + PostGIS
```

Repository layout:

```text
backend/                FastAPI service, models, routes, and tests
frontend/               React/Vite application
database/               Local PostGIS Docker Compose setup
docs/                   Specification, implementation guide, and progress
.github/workflows/       GitHub Actions CI
.husky/                 Pre-commit hook
```

### Backend

- FastAPI REST API under `/api`.
- SQLAlchemy ORM.
- JWT bearer authentication.
- Argon2 password hashing through `pwdlib`.
- `uv` dependency management in `backend/pyproject.toml`.
- `backend/uv.lock` pins resolved Python dependencies.
- Ruff checks import order, lint, and formatting.
- SQLite is used by isolated unit tests. PostgreSQL/PostGIS is used for local integration and deployment.

### Frontend

- React with TypeScript.
- Vite development and production build.
- Mapbox GL JS planned for site polygon drawing and rendering.
- Chart.js planned for metrics visualization.
- API client sends JWT bearer tokens and normalizes API errors.

## Implemented API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service health check |
| `POST` | `/api/auth/register` | Register user and return JWT |
| `POST` | `/api/auth/login` | Authenticate user and return JWT |
| `GET` | `/api/auth/me` | Return authenticated user |
| `GET` | `/api/projects` | List authenticated user's projects |
| `POST` | `/api/projects` | Create owned project |

Planned site and analytics routes are tracked in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Local setup

### Requirements

- Python 3.12 or newer
- `uv`
- Node.js 20 or newer
- npm 10 or newer
- Docker and Docker Compose for PostGIS
- Mapbox public token for mapping phase

### 1. Configure environment

```bash
cp .env.example .env
```

Set values in `.env`:

```text
DATABASE_URL=postgresql+psycopg://darukaa:darukaa@localhost:5432/darukaa
JWT_SECRET=use-a-long-random-secret
CORS_ORIGINS=http://localhost:5173
VITE_API_URL=http://localhost:8000/api
VITE_MAPBOX_TOKEN=your-public-mapbox-token
```

Do not commit `.env` or production secrets.

### 2. Start PostGIS

```bash
docker compose -f database/docker-compose.yml up -d
```

### 3. Install backend dependencies

```bash
uv sync --project backend --group dev
```

`uv sync` creates or updates `backend/.venv` from `backend/pyproject.toml` and `backend/uv.lock`.

### 4. Start backend

```bash
PYTHONPATH=backend uv run --project backend uvicorn app.main:app --reload --app-dir backend
```

Check service:

```bash
curl http://localhost:8000/api/health
```

### 5. Install and start frontend

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Quality checks

Install root hook dependencies and activate Husky:

```bash
npm ci
npm run prepare
```

Run all checks:

```bash
npm run quality
```

Individual checks:

```bash
npm run lint
npm run format:check
npm run lint:backend
npm run test:backend
```

Pre-commit behavior:

- ESLint and Prettier run for changed frontend files.
- Prettier runs for changed documentation.
- Ruff lint and format run for changed backend files.
- Full tests remain in CI, not in the fast commit hook.

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request:

1. Frontend: `npm ci`, ESLint, and Vite production build.
2. Backend: `uv sync`, Ruff format check, Ruff lint, and pytest.
3. Integration: PostGIS service, `uv sync`, and integration-marked tests.

CI uses `astral-sh/setup-uv`, `backend/uv.lock`, and Node lockfile `frontend/package-lock.json`.
Deployment is intentionally not enabled until Phase 5 credentials and target URLs are known.

## Testing

Backend tests cover:

- Registration and login.
- Duplicate email handling.
- Protected current-user route.
- Project creation and listing.
- Cross-user project isolation.
- Health endpoint.

Run:

```bash
npm run test:backend
```

## Security notes

- Passwords are hashed with Argon2.
- Project queries are scoped to authenticated user ID.
- JWT secret comes from environment configuration.
- CORS origins are configurable.
- Mapbox token is a public client token and must be URL-restricted in deployment.
- MVP stores JWT in browser local storage. Move to secure HTTP-only cookies if threat requirements increase.

## Commit and delivery rules

Use atomic, self-contained commits. Keep the provided challenge brief uncommitted unless explicitly requested.

Example commit types:

```text
feat: add site polygon API
fix: reject unclosed polygon geometry
chore: update CI dependency cache
docs: record deployment smoke test
```

Before a delivery commit:

```bash
npm run quality
git status
```

## Further documentation

- [`docs/PROJECT-SPEC.md`](docs/PROJECT-SPEC.md) — requirements, design, phases, and acceptance criteria.
- [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) — coding patterns and how each layer is implemented.
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — checked task list, current work, done criteria, and deferred scope.
