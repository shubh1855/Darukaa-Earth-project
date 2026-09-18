# Darukaa.Earth Submission Brief

## Project

**Name:** Darukaa.Earth

**Purpose:** A geospatial dashboard for managing carbon and biodiversity projects, drawing site boundaries, and reviewing seeded environmental indicators over time.

## Links

- **Repository:** `https://github.com/shubh1855/Darukaa-Earth-project`
- **Live frontend:** `https://darukaa-earth-project.onrender.com`
- **Live API:** `https://darukaa-earth-api-ha0j.onrender.com`
- **Health check:** `https://darukaa-earth-api-ha0j.onrender.com/api/health`

Health response:

```json
{"status":"ok"}
```

## Document structure

This brief follows the hackathon submission requirements:

1. Project identity and live links.
2. Reviewer access and demo flow.
3. Product features and analytics scope.
4. System architecture and deployment topology.
5. Database schema and PostGIS design.
6. Production configuration and migration process.
7. Local setup instructions.
8. Quality checks, CI, and API smoke testing.
9. Trade-offs, limitations, and submission checklist.

## Reviewer access

1. Open the live frontend.
2. Register a new account with an email and password of at least eight characters.
3. Create a project.
4. Create a polygon site on the map.
5. Select the site from the site list or map.
6. Click `Seed demo metrics`.

No shared reviewer password is required. Each reviewer can create a temporary account.

## Product features

- JWT registration, login, logout, and protected routes.
- Project creation and owner-isolated project lists.
- Mapbox GL map with polygon drawing and freehand drawing.
- Polygon validation and PostGIS area calculation.
- Saved site boundaries rendered on the map.
- Right-side site analytics drawer.
- 18 months of deterministic demo metrics.
- Separate carbon and biodiversity charts.
- Three-month carbon forecast.
- Month-over-month carbon change chart.
- Date filters: `3M`, `6M`, `12M`, and `All`.
- KPI cards for carbon, biodiversity, and carbon intensity.
- Direction-aware KPI deltas.
- Project-level analytics summaries and sparklines.
- CSV export for the visible analytics period.
- Development/reviewer seed action.
- Light and dark themes, with dark mode as default.
- Loading, empty, and API error states.

## Architecture

### Application architecture

```mermaid
flowchart TD
    Browser[React + TypeScript + Vite]
    Map[Mapbox GL JS map]
    Charts[Chart.js analytics]
    API[FastAPI REST API]
    Auth[JWT authentication]
    ORM[SQLAlchemy ORM]
    Migrations[Alembic migrations]
    DB[(PostgreSQL + PostGIS)]

    Browser --> Map
    Browser --> Charts
    Browser -->|REST + bearer token| API
    API --> Auth
    API --> ORM
    API --> Migrations
    ORM --> DB
    Migrations --> DB
```

### Production deployment topology

```mermaid
flowchart LR
    Reviewer[Reviewer browser]
    Frontend[Render Static Site]
    API[Render Web Service]
    Database[(Render Postgres with PostGIS)]
    Mapbox[Mapbox GL JS\nrestricted public token]

    Reviewer --> Frontend
    Frontend -->|HTTPS REST + JWT| API
    Frontend -->|Map tiles and map rendering| Mapbox
    API -->|Private PostgreSQL connection| Database
```

### Request and data flow

```mermaid
sequenceDiagram
    participant User
    participant UI as React dashboard
    participant API as FastAPI API
    participant DB as PostgreSQL/PostGIS

    User->>UI: Select project and site
    UI->>API: GET /api/sites/{id}/analytics
    API->>API: Validate JWT and project ownership
    API->>DB: Query ordered site metrics
    DB-->>API: Site geometry, area, and metrics
    API-->>UI: Analytics response
    UI->>UI: Render KPIs, charts, forecast, and status
```

### Deployment release flow

```mermaid
flowchart TD
    Commit[Push feature branch]
    CI[GitHub Actions checks]
    Build[Render Python 3.13 build]
    Migration[Alembic upgrade head]
    APIDeploy[Deploy FastAPI service]
    FrontendBuild[Build Vite static site]
    Smoke[API smoke test and reviewer flow]

    Commit --> CI
    CI --> Build
    Build --> Migration
    Migration --> APIDeploy
    CI --> FrontendBuild
    APIDeploy --> Smoke
    FrontendBuild --> Smoke
```

### Frontend

- React with TypeScript.
- Vite production build.
- Mapbox GL JS through `react-map-gl`.
- Chart.js through `react-chartjs-2`.
- Local component state for MVP workflow state.

### Backend

- FastAPI REST API under `/api`.
- SQLAlchemy ORM.
- Alembic migrations.
- JWT bearer authentication.
- Argon2 password hashing through `pwdlib`.
- PostgreSQL with PostGIS in deployed environments.

### Hosting

- Frontend: Render Static Site.
- API: Render Web Service.
- Database: Render Postgres.
- PostGIS extension: enabled on production database.

## Database schema

```text
users
  id             primary key
  email          unique, not null
  password_hash  not null
  created_at     not null

projects
  id             primary key
  owner_id       foreign key users.id
  name           not null
  description    text
  created_at     not null

sites
  id             primary key
  project_id     foreign key projects.id
  name           not null
  geometry       geometry(POLYGON, 4326)
  geometry_json  text
  area_hectares  not null
  created_at     not null

site_metrics
  id                    primary key
  site_id               foreign key sites.id with cascade delete
  period                date
  carbon_tonnes_co2e    nullable float
  biodiversity_score    nullable float from 0 to 100
  created_at            not null
  unique(site_id, period)
```

## Production configuration

API variables:

```text
DATABASE_URL=<Render internal PostgreSQL URL>
DATABASE_BOOTSTRAP=false
JWT_SECRET=<private random secret>
CORS_ORIGINS=https://darukaa-earth-project.onrender.com
```

Frontend variables:

```text
VITE_API_URL=https://darukaa-earth-api-ha0j.onrender.com/api
VITE_MAPBOX_TOKEN=<restricted public Mapbox token>
VITE_ENABLE_DEMO_SEED=true
```

Secrets are configured in Render and are not committed to the repository.

Production schema is created with:

```bash
PYTHONPATH=backend uv run --project backend \
  alembic -c backend/alembic.ini upgrade head
```

Runtime `Base.metadata.create_all` is disabled in production with `DATABASE_BOOTSTRAP=false`.

## Local setup

Requirements:

- Python 3.13 or newer.
- `uv`.
- Node.js 20 or newer.
- Docker and Docker Compose.
- Mapbox public token.

Start PostGIS:

```bash
sudo docker compose -f database/docker-compose.yml up -d
```

Install dependencies:

```bash
uv sync --project backend --group dev
npm ci
npm --prefix frontend ci
```

Configure local environment:

```text
DATABASE_URL=postgresql+psycopg://darukaa:darukaa@localhost:5432/darukaa
DATABASE_BOOTSTRAP=true
JWT_SECRET=local-development-secret
CORS_ORIGINS=http://localhost:5173
VITE_API_URL=http://localhost:8000/api
VITE_MAPBOX_TOKEN=<local public Mapbox token>
VITE_ENABLE_DEMO_SEED=true
```

Run migrations:

```bash
PYTHONPATH=backend uv run --project backend \
  alembic -c backend/alembic.ini upgrade head
```

Start API:

```bash
PYTHONPATH=backend uv run --project backend \
  uvicorn app.main:app --reload --app-dir backend
```

Start frontend:

```bash
npm --prefix frontend run dev
```

Open `http://localhost:5173`.

## Quality and CI

Run local checks:

```bash
npm run quality
npm --prefix frontend run build
PYTHONPATH=backend uv run --project backend \
  pytest backend/tests/test_postgis_integration.py -m integration -vv -rs
```

Current validation:

- 16 backend tests pass.
- PostGIS integration test passes.
- Frontend ESLint passes.
- Prettier passes.
- Ruff passes.
- Frontend production build passes.
- API smoke test passes against PostgreSQL.

GitHub Actions runs frontend, backend, and PostGIS integration jobs on pushes and pull requests.

## API smoke test

```bash
API_BASE=https://darukaa-earth-api-ha0j.onrender.com/api \
./scripts/smoke_api.sh
```

The smoke test covers registration, project creation, polygon site creation, area calculation, analytics seeding, analytics retrieval, invalid geometry rejection, and idempotent reseeding.

## Trade-offs and limitations

- Demo metrics are deterministic review indicators, not scientific carbon accounting.
- No live sensor, satellite, or remote-sensing integrations.
- No team roles or collaboration features.
- Polygon editing and deletion are outside MVP scope.
- JWT tokens use browser local storage for this MVP.
- Demo seeding is enabled for the reviewer deployment and should be disabled for a production deployment that must not expose demo data.
- Render free services may sleep when idle, so the first request can be slow.

## Submission checklist

- [x] Private GitHub repository available to reviewers.
- [x] Live frontend URL documented.
- [x] Live API URL documented.
- [x] PostgreSQL/PostGIS database deployed.
- [x] Alembic migration at head.
- [x] API health check passes.
- [x] API smoke test passes.
- [x] Reviewer seed button available.
- [x] README includes setup and architecture details.
- [ ] Add screenshots or demo recording.
- [ ] Convert this brief to `.docx` and submit through the job application page.
