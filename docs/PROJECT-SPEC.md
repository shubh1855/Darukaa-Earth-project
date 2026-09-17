# Darukaa.Earth — Product and Delivery Specification

**Document status:** Planning baseline  
**Target:** Usable MVP and submission-ready documentation by tomorrow evening  
**Primary user:** Administrator or project manager  
**Product goal:** Give administrators one clear workspace to manage environmental projects, map their sites, and review carbon and biodiversity performance.

## 1. Scope

### 1.1 MVP outcome

A signed-in administrator can:

1. Register and sign in.
2. Create and view carbon or biodiversity projects.
3. Add multiple sites to a project by drawing polygon boundaries on a map.
4. View all owned projects and sites on an interactive map.
5. Select a site and view its area, current indicators, and historical performance chart.
6. Run the project locally with documented environment variables.
7. Use a repository with automated formatting, linting, tests, and a CI workflow.

### 1.2 Explicit non-goals for deadline

- Public user roles, teams, invitations, and fine-grained permissions.
- Editing or deleting polygons after creation.
- GIS import/export, satellite imagery, live sensor ingestion, or remote-sensing analysis.
- Production-grade carbon accounting or biodiversity certification.
- Offline support, native mobile apps, and real-time collaboration.
- Billing, notifications, and advanced reporting exports.

These features can become post-MVP roadmap items. Do not add them before MVP acceptance passes.

## 2. Product requirements

### 2.1 Authentication

- Provide registration with email and password.
- Enforce password length of at least eight characters.
- Provide login and logout.
- Issue short-lived JWT access tokens.
- Protect every project, site, and analytics endpoint.
- Never return password hashes or tokens in application logs.
- Show clear validation and authentication errors without exposing sensitive details.

**Acceptance:** New user can register, refresh the page while authenticated, sign out, and cannot access another user's records.

### 2.2 Project management

- Show project list in a dashboard sidebar or list view.
- Show project name, description, creation date, and site count.
- Create a project with required name and optional description.
- Select a project to load its sites.
- Show an empty state when no project exists.

**Acceptance:** Creating a project persists it in the database and shows it after a page reload.

### 2.3 Geospatial sites

- Use Mapbox GL JS.
- Center map on a useful default region and allow pan, zoom, and navigation controls.
- Let user draw a closed polygon.
- Require a site name before save.
- Store polygon as GeoJSON with longitude/latitude coordinate order.
- Calculate and display approximate area in hectares.
- Render all project sites with readable fill and boundary styling.
- Make each site selectable from the map or site list.
- Reject invalid, empty, or non-polygon geometry.

**Data decision:** Store geometry in PostGIS `geometry(Polygon, 4326)` in deployed PostgreSQL. Keep GeoJSON at API boundaries. If local setup lacks PostGIS, use a documented development fallback only; production and CI must verify the PostGIS path.

**Acceptance:** User draws a polygon, saves it, sees it after reload, and sees a non-negative area value.

### 2.4 Analytics

- Show selected site name and area.
- Show latest carbon value in tonnes CO2e.
- Show latest biodiversity score on a 0–100 scale.
- Show a time-series chart for at least three periods when seed data is used.
- Label units and time periods.
- Show a useful empty state when metrics are unavailable.
- Seed demo metrics for a new demo environment so reviewers can see the feature immediately.

**Acceptance:** Selecting a site opens a detail panel or page. Chart labels, values, units, and empty state are understandable without domain knowledge.

### 2.5 Quality and delivery

- Add backend unit/API tests for authentication, ownership, project creation, and site creation.
- Add frontend lint and production build checks.
- Configure pre-commit checks with Husky and lint-staged for frontend files. Add equivalent Python formatting/lint commands for backend.
- Add GitHub Actions workflow for dependency install, lint, test, and build.
- Document deployment, environment variables, seed data, trade-offs, and known limitations.

## 3. User journeys

### Journey A: First use

1. Visitor opens application.
2. Visitor registers with email and password.
3. Application stores account and signs visitor in.
4. Empty dashboard explains how to create first project.
5. Visitor creates project.

### Journey B: Add site

1. User selects project.
2. User clicks `Add site`.
3. User enters site name.
4. User draws polygon on map.
5. User submits polygon.
6. API validates ownership and geometry.
7. API stores polygon and computed area.
8. Map refreshes and displays site.

### Journey C: Review performance

1. User clicks site marker, polygon, or site card.
2. Client requests site detail and metrics.
3. Detail view shows area, latest values, and historical chart.
4. User closes detail view and returns to map without losing project context.

## 4. Technical design

### 4.1 Architecture

Use a small monorepo:

```text
/
  frontend/       React + TypeScript + Vite
  backend/        FastAPI + SQLAlchemy
  database/       PostgreSQL + PostGIS initialization/migrations
  docs/           product and delivery documentation
  .github/        CI workflow
```

Request flow:

```text
React dashboard
  -> FastAPI REST API
    -> JWT authentication and ownership checks
      -> PostgreSQL/PostGIS
```

Use REST for MVP. Keep frontend state local to the active dashboard. Avoid Redux or a separate service layer until repeated state complexity requires it.

### 4.2 Frontend design

- React with TypeScript.
- Mapbox GL JS through a maintained React integration or direct Mapbox instance.
- Chart.js for time-series charts.
- React Router only if separate login/dashboard/detail routes improve navigation; a dashboard modal is acceptable for MVP.
- One API client adds base URL, bearer token, JSON headers, and consistent error handling.
- Use responsive layout: sidebar/list on desktop, stacked controls on mobile.
- Use accessible buttons, labels, focus states, keyboard-close modal behavior, and sufficient color contrast.
- Use loading, success, empty, and error states for each network-backed view.

Visual direction:

- Nature-focused palette: deep forest text, muted green accents, warm neutral background.
- Serif display heading with readable sans-serif body text.
- Cards communicate project/site hierarchy.
- Do not use color alone to communicate metric status.

### 4.3 Backend design

- FastAPI application with versioned `/api` routes.
- Pydantic schemas separate request and response contracts.
- SQLAlchemy models and Alembic migrations.
- Dependency-injected database sessions.
- JWT bearer authentication.
- Password hashing with bcrypt or Argon2.
- CORS restricted to configured frontend origin.
- Central error format: `{ "detail": "safe human-readable message" }`.
- Validate project ownership before every site or metric read/write.

### 4.4 Database schema

```text
users
  id             BIGINT primary key
  email          VARCHAR unique not null
  password_hash  VARCHAR not null
  created_at     TIMESTAMP not null

projects
  id             BIGINT primary key
  owner_id       BIGINT foreign key users.id not null
  name           VARCHAR not null
  description    TEXT
  created_at     TIMESTAMP not null

sites
  id             BIGINT primary key
  project_id     BIGINT foreign key projects.id not null
  name           VARCHAR not null
  geometry       geometry(Polygon, 4326) not null
  area_hectares  NUMERIC not null
  created_at     TIMESTAMP not null

site_metrics
  id                    BIGINT primary key
  site_id               BIGINT foreign key sites.id not null
  period                DATE not null
  carbon_tonnes         NUMERIC not null
  biodiversity_score    NUMERIC not null
  unique(site_id, period)
```

Indexes:

- `users.email` unique index.
- `projects.owner_id` index.
- `sites.project_id` index.
- GiST index on `sites.geometry`.
- `site_metrics(site_id, period)` index.

### 4.5 API contract

| Method | Route                      | Auth | Purpose                              |
| ------ | -------------------------- | ---: | ------------------------------------ |
| `GET`  | `/api/health`              |   No | Health check                         |
| `POST` | `/api/auth/register`       |   No | Create account and return token      |
| `POST` | `/api/auth/login`          |   No | Verify credentials and return token  |
| `GET`  | `/api/projects`            |  Yes | List owned projects with site counts |
| `POST` | `/api/projects`            |  Yes | Create project                       |
| `GET`  | `/api/projects/{id}/sites` |  Yes | List sites for owned project         |
| `POST` | `/api/projects/{id}/sites` |  Yes | Validate and create polygon site     |
| `GET`  | `/api/sites/{id}`          |  Yes | Return site and ordered metrics      |

Example site request:

```json
{
  "name": "North restoration block",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [77.59, 12.97],
        [77.6, 12.97],
        [77.6, 12.98],
        [77.59, 12.97]
      ]
    ]
  }
}
```

Example site response:

```json
{
  "id": 12,
  "project_id": 3,
  "name": "North restoration block",
  "geometry": { "type": "Polygon", "coordinates": [] },
  "area_hectares": 12.4,
  "metrics": [
    { "period": "2024-01", "carbon_tonnes": 42.1, "biodiversity_score": 68.0 }
  ]
}
```

## 5. Security and reliability

- Store secrets only in environment variables.
- Provide `.env.example`; never commit `.env` or Mapbox tokens.
- Use a strong production JWT secret.
- Use HTTPS on deployed frontend and API.
- Restrict Mapbox token by URL where provider supports it.
- Use server-side ownership checks; never trust project IDs from the client.
- Limit request body size and add basic rate limiting if deployment platform supports it.
- Use database migrations instead of runtime schema creation in production.
- Add a health check that verifies application availability and, in deployment, database connectivity.
- Back up production database before schema changes.

## 6. Phased delivery plan

### Phase 0 — Confirm scope and bootstrap (30–45 minutes)

**Build:** repository structure, environment examples, local run instructions, dependency manifests, database connection, health endpoint.  
**Proof:** frontend starts; backend health returns 200; database connection works.  
**Stop condition:** do not add extra product features until both services run locally.

### Phase 1 — Authentication (45–60 minutes)

**Build:** user table, password hashing, register/login endpoints, JWT dependency, login/register screens, token persistence, logout.  
**Proof:** API tests for valid registration, duplicate email, invalid login, and protected route.  
**Stop condition:** protected project route rejects missing or invalid token.

### Phase 2 — Projects (45–60 minutes)

**Build:** project migration/model, create/list endpoints, dashboard project list, create form, empty/loading/error states.  
**Proof:** create project through UI; reload; project remains; project from another user is not visible.  
**Stop condition:** project CRUD path is stable before map work.

### Phase 3 — Geospatial sites (90–120 minutes)

**Build:** PostGIS model and migration, Mapbox map, polygon drawing, geometry validation, area calculation, site endpoint, site list, map layers.  
**Proof:** draw and save polygon; reload; rendered geometry matches stored geometry; invalid polygon returns 422.  
**Fallback:** if Mapbox token or PostGIS deployment blocks progress, keep a clearly documented demo fixture and local mock mode, but do not claim full geospatial completion.

### Phase 4 — Analytics (45–60 minutes)

**Build:** metric migration/model, seed data, site detail endpoint, analytics panel, Chart.js line chart, KPI cards, no-data state.  
**Proof:** selected site shows correct metrics in chronological order and correct units.

### Phase 5 — Quality gates and delivery (60–90 minutes)

**Build:** backend tests, frontend lint/build, formatting, Husky/lint-staged, GitHub Actions, Docker Compose or deployment configuration, README, screenshots, submission notes.  
**Proof:** clean checkout passes documented commands; CI passes; deployed URL loads; reviewer can create account and demo project.

### Time cut rule

If time becomes limited, finish in this order:

1. Auth and protected API.
2. Project creation/listing.
3. Map site creation and persistence.
4. Analytics view with seed data.
5. CI, README, and deployment.

Cut animation, polygon editing, delete flows, advanced filters, and visual polish before cutting acceptance-critical paths.

## 7. Testing strategy

### Backend

- Unit test password and JWT helpers.
- API test registration and login.
- API test protected route behavior.
- API test project ownership.
- API test polygon validation and area calculation.
- API test site detail response ordering.

### Frontend

- Lint TypeScript and React hooks.
- Production build with no TypeScript errors.
- Manual smoke test auth, project creation, polygon creation, site selection, chart, logout.
- Test desktop and narrow mobile viewport.

### Acceptance checklist

- [ ] New user can register.
- [ ] Existing user can log in and log out.
- [ ] Unauthenticated API requests fail.
- [ ] User can create project.
- [ ] User can draw and save polygon.
- [ ] Saved site survives refresh.
- [ ] Site area displays in hectares.
- [ ] Site detail shows metrics chart.
- [ ] Another user cannot read or modify records.
- [ ] Frontend build passes.
- [ ] Backend tests pass.
- [ ] CI workflow passes.
- [ ] README explains architecture, schema, setup, CI/CD, and known limitations.
- [ ] Live URL and repository access details are ready for submission.

## 8. Deployment plan

Recommended deadline-safe split:

- Frontend: Vercel.
- Backend: Render web service.
- Database: Render PostgreSQL with PostGIS if available, or managed PostgreSQL provider with PostGIS enabled.
- CI: GitHub Actions on push and pull request.

Required production variables:

```text
DATABASE_URL=postgresql+psycopg://...
JWT_SECRET=<strong-random-secret>
CORS_ORIGINS=https://<frontend-domain>
VITE_API_URL=https://<api-domain>/api
VITE_MAPBOX_TOKEN=<restricted-public-mapbox-token>
```

Deployment smoke checks:

1. Open frontend URL.
2. Verify API health endpoint.
3. Register reviewer account.
4. Create project.
5. Draw and save site.
6. Open analytics.
7. Confirm refresh preserves data.

## 9. Repository and submission deliverables

- Private GitHub repository with logical commits and reviewer access.
- Public live demo URL.
- `README.md` with architecture, schema, setup, environment variables, tests, CI/CD, seed data, and limitations.
- `.env.example` files without secrets.
- GitHub Actions workflow.
- Screenshots or short demo recording if allowed.
- Word document containing repository URL, live URL, README summary, credentials or demo notes, and access instructions.

If repository remains private, grant access to:

- ankita.dasgupta@darukaa.com
- harsh.kumar@darukaa.com
- utkarsh.gauniyal@darukaa.com
- guneet.mutreja@darukaa.com

## 10. Decisions and trade-offs

- **FastAPI over Django:** smaller API surface and faster validation for a one-day MVP. Django becomes useful if admin workflows, permissions, or a large domain model appear.
- **PostGIS over plain coordinates:** enables correct spatial storage, indexing, and future GIS queries. GeoJSON remains the simple client contract.
- **Chart.js over Highcharts:** suitable for one time-series view with fewer licensing concerns for this scope.
- **JWT access token:** meets challenge requirement and keeps frontend/API independently deployable. Add refresh-token rotation only after MVP.
- **Seed metrics:** makes analytics reviewable without pretending data comes from a production sensor pipeline.
- **No delete/edit in MVP:** reduces destructive-action and geometry-editing risk under deadline. Add confirmation and audit behavior before production use.

## 11. Known limitations to disclose

- Demo metrics are seeded and not scientifically validated.
- Area calculation depends on valid WGS84 polygon geometry and should use a geodesic/PostGIS calculation for production accuracy.
- MVP has one administrator role and no team sharing.
- JWT storage strategy must be hardened with an HTTP-only cookie design if threat model requires protection from token theft through XSS.
- Mapbox requires an access token and may incur provider usage limits.
- Production deployment requires PostGIS-enabled PostgreSQL and migration execution.

## 12. Implementation runbook

Implement in vertical slices. Each slice must leave repository runnable and include its proof before next slice starts.

### 12.1 Bootstrap sequence

1. Create `frontend/`, `backend/`, `database/`, `docs/`, `.github/workflows/`, and `.husky/`.
2. Add frontend package manifest with React, TypeScript, Vite, Mapbox GL JS, `react-map-gl`, Chart.js, ESLint, and Prettier.
3. Add backend package manifest with FastAPI, SQLAlchemy, Alembic, Psycopg, JWT, password hashing, pytest, and HTTPX.
4. Add `.env.example` files. Keep real tokens outside Git.
5. Add Docker Compose with PostGIS for repeatable local database setup.
6. Add a minimal FastAPI `/api/health` endpoint and Vite placeholder page.
7. Run frontend build, backend tests, and hook commands before feature work.

### 12.2 Backend implementation method

- Create SQLAlchemy models from the schema in dependency order: `User`, `Project`, `Site`, `SiteMetric`.
- Create Alembic migrations. Enable PostGIS in the first database migration.
- Keep API schemas separate from ORM models. Use GeoJSON `dict` only at the API boundary.
- Add one database-session dependency and one current-user dependency.
- Hash passwords at registration. Decode JWT subject and load user on protected requests.
- Scope every query through authenticated user ownership. Return `404` for inaccessible records to avoid leaking record existence.
- Validate polygon type, ring closure, minimum coordinate count, and coordinate bounds.
- Convert GeoJSON to PostGIS geometry on write and PostGIS geometry back to GeoJSON on read.
- Calculate area with `ST_Area(ST_Transform(geometry, 6933)) / 10000` so displayed hectares are based on projected metres, not degree arithmetic.
- Return metrics ordered by period ascending. Add seed metrics only through an explicit seed command.
- Test each route with an isolated database and authenticated test client.

### 12.3 Frontend implementation method

- Build an API client first. It owns base URL, bearer token, JSON parsing, and safe error extraction.
- Build authentication screen against real register/login endpoints before styling dashboard.
- Build project list and create form against real endpoints. Add loading, empty, success, and error states.
- Initialize Mapbox only after a token exists. Keep map view state separate from server data.
- Use Mapbox Draw for polygon creation. On draw completion, normalize the feature to a Polygon GeoJSON object and open the site-name form.
- Disable save until site name and valid polygon exist. On save success, refetch project sites and clear draw state.
- Render server geometry as a GeoJSON source and layers. Use feature IDs for selection.
- Fetch selected site detail only when selection changes. Transform metrics into Chart.js labels and datasets.
- Keep route-level components small: `AuthPage`, `DashboardPage`, `ProjectList`, `ProjectMap`, `SiteForm`, and `SiteAnalytics`.
- Add keyboard focus, modal Escape handling, visible focus rings, labels, and responsive layout before final polish.

### 12.4 Database and local environment method

```bash
cp .env.example .env
docker compose -f database/docker-compose.yml up -d
uv sync --project backend --group dev
PYTHONPATH=backend uv run --project backend alembic upgrade head
PYTHONPATH=backend uv run --project backend uvicorn app.main:app --reload --app-dir backend
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Use a committed `database/seed.py` or backend seed command for demo metrics. Never run seed data automatically on every application startup because that can duplicate or overwrite reviewer data.

### 12.5 Hook behavior

- `pre-commit` runs `lint-staged` for changed frontend files.
- Frontend staged TypeScript/TSX files run ESLint and Prettier.
- Frontend staged CSS/JSON/Markdown files run Prettier.
- Backend staged Python files run Ruff format and Ruff check when Ruff is installed.
- Hooks must fail on formatter or lint errors. Do not use hooks to run slow integration tests.
- CI remains authoritative for full backend tests, frontend build, and dependency checks.

### 12.6 Workflow behavior

GitHub Actions runs on every push and pull request:

1. `frontend` job uses a locked Node version, runs `npm ci`, lint, and production build.
2. `backend` job uses a locked Python version, installs requirements, runs Ruff checks, and runs pytest.
3. `integration` job starts PostGIS, applies migrations, and runs API integration tests.
4. Optional deployment jobs run only after CI succeeds on the protected default branch.

Keep deployment credentials in GitHub Actions secrets. Never put provider tokens in workflow YAML.

### 12.7 Definition of done per phase

A phase is done only when its code, tests, documentation, and manual acceptance check are complete. Record failures in the README or issue list. Do not start the next phase with known failing checks unless the failure is documented as a deadline trade-off.
