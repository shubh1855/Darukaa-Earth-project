# Implementation Guide

This document explains how Darukaa.Earth is built and how to continue work without breaking completed phases.

## 1. Development model

Build one vertical slice at a time:

1. Define API contract and acceptance test.
2. Add database model or migration.
3. Add service and route logic.
4. Add frontend state and UI.
5. Run lint, format, and tests.
6. Commit one self-contained change.

Do not add UI that depends on an endpoint that does not exist. Do not add an endpoint without an ownership test.

## 2. Current request flow

```text
Browser
  -> React API client
    -> FastAPI route
      -> JWT current-user dependency
        -> SQLAlchemy session
          -> PostgreSQL/PostGIS or local SQLite fallback
```

Authentication flow:

1. `AuthScreen` sends email and password to `/api/auth/register` or `/api/auth/login`.
2. FastAPI validates input with Pydantic.
3. `pwdlib[argon2]` hashes or verifies the password.
4. API returns a signed JWT containing user ID in `sub`.
5. Frontend stores token in `localStorage` for this MVP.
6. Protected requests send `Authorization: Bearer <token>`.
7. `get_current_user` validates token and loads the user.

Project flow:

1. `Dashboard` loads `/api/projects` after token exists.
2. API filters projects by `Project.owner_id`.
3. Create form sends `POST /api/projects`.
4. API trims name and description, assigns authenticated owner, persists project.
5. Frontend prepends returned project to current list.

## 3. Backend conventions

### Route ownership

Every protected route must receive `user: User = Depends(get_current_user)`. Use authenticated user ID in query filters. Never accept owner ID from request body.

```python
query = select(Project).where(Project.owner_id == user.id)
```

For child resources, load through parent ownership or join ownership before returning data. Return `404` for inaccessible resources so the API does not reveal whether another user's record exists.

### Schema boundaries

- ORM models live in `backend/app/models.py`.
- Request and response contracts live in `backend/app/schemas.py`.
- Routes translate request schemas into models.
- Do not expose password hashes.
- Use `ConfigDict(from_attributes=True)` for ORM response schemas.

### Database changes

All production schema changes must use Alembic migrations. Runtime `Base.metadata.create_all` exists only as bootstrap support for the current local MVP and tests. Replace it with migration startup before deployment.

Next migration sequence:

1. Add Alembic environment and initial user/project migration.
2. Add `sites` table with PostGIS geometry.
3. Add `site_metrics` table and indexes.
4. Add seed command for demo metrics.

### Geospatial write path

1. Accept GeoJSON Polygon.
2. Validate geometry type, ring closure, coordinate count, and WGS84 bounds.
3. Convert GeoJSON to PostGIS geometry with SRID 4326.
4. Calculate area using projected metres, then divide by 10,000 for hectares.
5. Store original geometry in PostGIS.
6. Convert geometry back to GeoJSON in response.

Use PostGIS functions instead of planar degree arithmetic:

```sql
ST_Area(ST_Transform(geometry, 6933)) / 10000
```

## 4. Frontend conventions

### API client

Keep network behavior in one request helper. It must:

- Prefix `VITE_API_URL`.
- Add JSON headers.
- Add bearer token when available.
- Parse safe `detail` errors.
- Throw on non-2xx responses.

### State

Use component state for MVP. Keep these states explicit:

- `loading`
- `pending`
- `error`
- `empty`
- loaded data

Do not add global state or a data-fetching library until multiple screens need shared cache behavior.

### Mapbox

The map phase must use a restricted public Mapbox token from `VITE_MAPBOX_TOKEN`. Never put a private server token in frontend code.

Recommended components:

```text
DashboardPage
  ProjectSidebar
  ProjectMap
    MapboxDraw
  SiteForm
  SiteAnalytics
```

Keep drawn geometry in local state until the user enters a name and confirms save. Refetch sites after save instead of manually merging uncertain geometry state.

## 5. Local commands

Install tools:

```bash
uv --version
node --version
npm --version
```

Install and sync dependencies:

```bash
uv sync --project backend --group dev
npm install
cd frontend && npm install
```

Run database:

```bash
docker compose -f database/docker-compose.yml up -d
```

Run API:

```bash
PYTHONPATH=backend uv run --project backend uvicorn app.main:app --reload --app-dir backend
```

Run frontend:

```bash
cd frontend
npm run dev
```

Run checks:

```bash
npm run lint
npm run format:check
npm run lint:backend
npm run test:backend
npm run quality
```

## 6. Commit rules

Use atomic commits. Each commit must describe one complete change and pass relevant checks.

Good examples:

```text
feat: add site polygon API and ownership tests
feat: render project sites with Mapbox layers
feat: add site analytics chart
fix: reject unclosed polygon rings
chore: add PostGIS integration workflow
```

Avoid commits mixing unrelated UI, schema, and deployment changes unless they form one inseparable vertical slice.

## 7. Security checklist

- [ ] Production `JWT_SECRET` is random and not committed.
- [ ] CORS contains only deployed frontend origins.
- [ ] Mapbox token has URL restrictions.
- [ ] Every resource query checks owner.
- [ ] Error responses do not include stack traces.
- [ ] Password hashes never appear in responses or logs.
- [ ] Database credentials exist only in environment variables.
- [ ] HTTPS is enabled on deployed services.

## 8. Known temporary choices

- SQLite remains available for fast unit tests; deployment uses PostgreSQL/PostGIS.
- Runtime table creation supports the first local slice; migrations are required before production.
- `localStorage` token storage is acceptable for this challenge MVP but should move to an HTTP-only cookie if the threat model requires stronger XSS protection.
- Demo metrics will be seed data, not verified scientific measurements.
