# Deployment Guide

Darukaa.Earth uses PostgreSQL with PostGIS in production. SQLite is only a local test fallback.

## Required services

- API: FastAPI service running Python 3.12+.
- Frontend: Vite static build.
- Database: PostgreSQL 16 with PostGIS 3.4 or newer.

## Production environment

Set these variables on the API service:

```text
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_BOOTSTRAP=false
JWT_SECRET=<long-random-secret>
CORS_ORIGINS=https://frontend.example.com
```

Set these variables on the frontend build:

```text
VITE_API_URL=https://api.example.com/api
VITE_MAPBOX_TOKEN=<restricted-public-mapbox-token>
VITE_ENABLE_DEMO_SEED=true
```

`VITE_ENABLE_DEMO_SEED=true` displays `Seed demo metrics` for authenticated reviewers when a selected site has no metrics. The seed endpoint only writes to projects owned by the signed-in user and remains idempotent. Disable this flag for production environments that should not expose demo data.

Never commit production secrets. Restrict `VITE_MAPBOX_TOKEN` to deployed frontend origins.

## Release sequence

Run from a release environment with database access:

```bash
uv sync --project backend --group dev
PYTHONPATH=backend uv run --project backend \
  alembic -c backend/alembic.ini upgrade head
```

Verify migration state:

```bash
PYTHONPATH=backend uv run --project backend \
  alembic -c backend/alembic.ini current
```

Expected result:

```text
20260918_0002 (head)
```

Start API only after migrations finish:

```bash
PYTHONPATH=backend uv run --project backend \
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir backend
```

`DATABASE_BOOTSTRAP=false` prevents runtime table creation. Alembic owns production schema changes.

Build frontend:

```bash
npm ci --prefix frontend
npm --prefix frontend run build
```

Serve `frontend/dist` through the selected static host or web server.

## Release checks

Run before release:

```bash
npm run quality
npm --prefix frontend run build
PYTHONPATH=backend uv run --project backend \
  pytest backend/tests/test_postgis_integration.py -m integration -vv -rs
```

Run smoke test against the deployed API and database:

```bash
API_BASE_URL=https://api.example.com/api \
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE \
./scripts/smoke_api.sh
```

Smoke test must verify registration, project creation, polygon site creation, PostGIS area calculation, analytics, 18-month seeding, invalid geometry rejection, and idempotent reseeding.

## Health check

```bash
curl https://api.example.com/api/health
```

Expected response:

```json
{"status":"ok"}
```

## Database checks

Confirm these before accepting deployment:

- PostGIS extension exists.
- `sites.geometry` is `POLYGON` with SRID `4326`.
- Alembic reports `20260918_0002 (head)`.
- `site_metrics` has the unique `(site_id, period)` constraint.
- Foreign key cascade exists from `site_metrics.site_id` to `sites.id`.
- Every seeded site has 18 unique monthly periods.

## Rollback

Do not run `alembic downgrade` against production without a database backup and an approved rollback plan. Prefer deploying a forward migration. Restore database backups only after confirming data loss and recovery impact.

## Reviewer path

1. Open frontend URL.
2. Register or log in.
3. Create a project.
4. Create a polygon site.
5. Select the site.
6. Click `Seed demo metrics` in development-enabled environments.
7. Confirm KPI cards and charts populate.
8. Test date filters and CSV export.
9. Refresh page and confirm data persists.
