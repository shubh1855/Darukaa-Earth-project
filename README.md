# Darukaa.Earth

Full-stack geospatial dashboard for carbon and biodiversity projects.

## Current status

- Phase 0 bootstrap complete.
- Phase 1 authentication backend complete with tests.
- Frontend scaffold ready for dashboard implementation.

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

### Backend

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn app.main:app --reload --app-dir backend
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
npm run test:backend
```

## CI workflow

GitHub Actions workflow at `.github/workflows/ci.yml` runs:

- Frontend lint/build when `frontend/package-lock.json` exists.
- Backend Ruff + pytest when `backend/requirements.txt` exists.
- Integration marker tests against PostGIS service.

## Next implementation steps

1. Add project CRUD backend and ownership checks.
2. Add site polygon API with PostGIS geometry conversion.
3. Build dashboard UI with project list and map rendering.
4. Add site analytics endpoint and chart view.
