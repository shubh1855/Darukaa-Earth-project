# Darukaa.Earth Progress

**Last updated:** 2026-09-17  
**Target:** MVP ready for review by tomorrow evening

Legend: `[x]` done, `[~]` in progress, `[ ]` not started, `[-]` deferred or intentionally out of MVP scope.

## Phase 0 — Foundation

- [x] Create monorepo layout.
- [x] Write product specification and acceptance criteria.
- [x] Write implementation guide and delivery plan.
- [x] Add root `.gitignore` and environment template.
- [x] Add root npm scripts and lockfile.
- [x] Add Husky pre-commit hook.
- [x] Add lint-staged rules for frontend, backend, and docs.
- [x] Add frontend ESLint and Prettier configuration.
- [x] Add backend Ruff configuration.
- [x] Add backend `pyproject.toml` with uv dependency groups.
- [x] Add backend `uv.lock`.
- [x] Add local PostGIS Docker Compose service.
- [x] Add GitHub Actions frontend, backend, and integration jobs.
- [x] Add bootstrap README.

## Phase 1 — Authentication

- [x] Add `User` SQLAlchemy model.
- [x] Add registration endpoint.
- [x] Add login endpoint.
- [x] Add current-user endpoint.
- [x] Add JWT creation and validation.
- [x] Add Argon2 password hashing with `pwdlib`.
- [x] Add duplicate email handling.
- [x] Add invalid credential handling.
- [x] Add protected-route dependency.
- [x] Add registration and login UI.
- [x] Add token persistence and logout UI.
- [x] Add authentication tests.

## Phase 2 — Projects

- [x] Add `Project` model.
- [x] Add project owner relationship.
- [x] Add project create endpoint.
- [x] Add project list endpoint.
- [x] Trim and validate project fields.
- [x] Scope project queries to authenticated owner.
- [x] Add project creation form.
- [x] Add project list UI.
- [x] Add loading state.
- [x] Add empty state.
- [x] Add API error state.
- [x] Add project ownership tests.
- [x] Run full local quality checks.

## Phase 3 — Sites and mapping

### Backend

- [ ] Add Alembic environment and initial migration.
- [ ] Enable PostGIS extension in migration.
- [ ] Add `Site` model.
- [ ] Add PostGIS `geometry(Polygon, 4326)` column.
- [ ] Add site request and response schemas.
- [ ] Validate Polygon geometry type.
- [ ] Validate closed linear rings and coordinate bounds.
- [ ] Add project ownership checks for site routes.
- [ ] Calculate area with projected PostGIS geometry.
- [ ] Add `GET /api/projects/{id}/sites`.
- [ ] Add `POST /api/projects/{id}/sites`.
- [ ] Add `GET /api/sites/{id}`.
- [ ] Add geometry unit tests.
- [ ] Add PostGIS integration tests.

### Frontend

- [ ] Add Mapbox token configuration.
- [ ] Add interactive Mapbox map.
- [ ] Add navigation controls.
- [ ] Add Mapbox Draw polygon control.
- [ ] Add site-name form after polygon draw.
- [ ] Disable save for invalid geometry.
- [ ] Save polygon through API.
- [ ] Refetch sites after save.
- [ ] Render saved GeoJSON polygons.
- [ ] Add site list and selection state.
- [ ] Display calculated hectares.
- [ ] Add mobile layout for map and site list.

**Current phase:** `[~]` Phase 3 is next implementation slice. Backend model and API work starts first.

## Phase 4 — Analytics

- [ ] Add `SiteMetric` model and migration.
- [ ] Add unique `(site_id, period)` constraint.
- [ ] Add metric seed command.
- [ ] Add ordered metric response.
- [ ] Add latest carbon KPI.
- [ ] Add latest biodiversity KPI.
- [ ] Add Chart.js time-series chart.
- [ ] Add no-data state.
- [ ] Add analytics API tests.
- [ ] Add analytics UI smoke test.

## Phase 5 — Delivery

- [ ] Add production migration command.
- [ ] Verify PostGIS deployment database.
- [ ] Deploy API.
- [ ] Deploy frontend.
- [ ] Configure production CORS.
- [ ] Configure restricted Mapbox token.
- [ ] Add deployment health check.
- [ ] Run reviewer smoke test.
- [ ] Capture screenshots or demo recording.
- [ ] Complete README deployment notes.
- [ ] Prepare Word submission document.
- [ ] Add live demo URL.
- [ ] Grant private repository access if needed.

## Deferred from MVP

- [-] Polygon editing.
- [-] Polygon deletion.
- [-] Team sharing and roles.
- [-] GIS import/export.
- [-] Live sensor integrations.
- [-] Scientific carbon accounting.
- [-] Advanced filtering and reports.
- [-] Native mobile app.
- [-] Real-time collaboration.

## Validation record

- [x] Frontend ESLint passes locally.
- [x] Prettier format check passes locally.
- [x] Ruff backend lint passes locally.
- [x] Backend pytest passes locally: 6 tests.
- [ ] GitHub Actions run passes after workflow cleanup.
- [ ] PostGIS integration test passes in CI.

Known non-blocking warnings: SQLAlchemy and `python-jose` currently emit upstream `datetime.utcnow` deprecation warnings under Python 3.13.
