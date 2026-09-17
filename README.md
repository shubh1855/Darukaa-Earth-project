# Darukaa.Earth

Full-stack geospatial dashboard for carbon and biodiversity projects.

## Current progress

- Phase 0: complete — repository, uv, Ruff, hooks, CI, PostGIS compose.
- Phase 1: complete — JWT authentication API and UI.
- Phase 2: complete — project creation, listing, and ownership isolation.
- Phase 3: next — PostGIS sites and Mapbox polygon drawing.
- Phase 4: planned — metrics and analytics chart.
- Phase 5: planned — deployment and submission QA.

See [`docs/PROGRESS.md`](docs/PROGRESS.md) for task-level status and [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) for implementation conventions.

## Repository layout

```text
backend/     FastAPI service
frontend/    React + Vite app
database/    Local PostGIS compose file
docs/        Product and delivery specification
```

## Environment

Copy root environment file and set values:

```bash
cp .env.example .env
```

Minimum variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `VITE_API_URL`
- `VITE_MAPBOX_TOKEN`

## Local run

### Database

```bash
docker compose -f database/docker-compose.yml up -d
```

### Backend (uv)

```bash
uv sync --project backend --group dev
PYTHONPATH=backend uv run --project backend uvicorn app.main:app --reload --app-dir backend
```

Backend health check:

```bash
curl http://localhost:8000/api/health
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Quality checks

### Git hook install

```bash
npm install
npm run prepare
```

### Manual checks

```bash
npm run lint
npm run format:check
npm run lint:backend
npm run test:backend
```

## CI workflow

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- Frontend lint/build when `frontend/package-lock.json` exists.
- Backend uv sync, Ruff, and pytest when `backend/requirements.txt` exists.
- Integration marker tests against PostGIS service.

## Next implementation steps

1. Add PostGIS site model, migrations, and GeoJSON validation.
2. Add site create/list/detail endpoints with ownership checks.
3. Add Mapbox polygon drawing and saved site layers.
4. Add site analytics endpoint, seed metrics, and Chart.js view.
5. Deploy and complete reviewer smoke test.
