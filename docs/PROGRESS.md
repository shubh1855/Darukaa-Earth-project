# Darukaa.Earth Progress

**Last updated:** 2026-09-18
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

- [x] Add Alembic environment and idempotent initial migration.
- [x] Enable PostGIS extension in migration.
- [x] Add `Site` model.
- [x] Add PostGIS `geometry(Polygon, 4326)` column with SQLite compatibility.
- [x] Add site request and response schemas.
- [x] Validate Polygon geometry type.
- [x] Validate closed linear rings and coordinate bounds.
- [x] Add project ownership checks for site routes.
- [x] Calculate area with projected PostGIS geometry.
- [x] Add `GET /api/projects/{id}/sites`.
- [x] Add `POST /api/projects/{id}/sites`.
- [x] Add `GET /api/sites/{id}`.
- [x] Add geometry unit tests.
- [x] Add PostGIS integration test with safe skip when unavailable.

### Frontend

- [x] Add Mapbox token configuration.
- [x] Add interactive Mapbox map.
- [x] Add navigation controls.
- [x] Add Mapbox Draw polygon and freehand controls.
- [x] Add site-name form after polygon draw.
- [x] Disable save for invalid geometry.
- [x] Save polygon through API.
- [x] Refetch sites after save.
- [x] Render saved GeoJSON polygons.
- [x] Add site list and selection state.
- [x] Display calculated hectares.
- [x] Add responsive layout for map and site list.

**Current phase:** `[x]` Phase 3 is complete; Phase 4 analytics is ready to begin.

## Phase 4 — Analytics

**Goal:** Let a user select a saved site and understand its latest carbon value, latest biodiversity score, and historical trend using seeded demo metrics. Metrics are demo indicators for the MVP, not scientific certification or production carbon accounting.

### 4.1 Data model and migration

- [x] Add `SiteMetric` SQLAlchemy model linked to `Site`.
- [x] Store one metric row per site and period with:
  - `site_id` foreign key.
  - `period` as an ordered ISO date or month value.
  - `carbon_tonnes_co2e` nullable numeric value.
  - `biodiversity_score` nullable numeric value from 0 to 100.
  - `created_at` timestamp.
- [x] Add a unique constraint on `(site_id, period)`.
- [x] Add indexes for `site_id` and ordered `period` lookups.
- [x] Add an Alembic migration that works with PostgreSQL and SQLite tests.
- [x] Preserve cascade behavior when a project/site is removed.

### 4.2 Seed data and API

- [x] Add a repeatable demo metric seed command or service.
- [x] Seed at least 18 monthly periods per demo site.
- [x] Make seeding idempotent using `(site_id, period)`.
- [x] Add an authenticated site analytics endpoint:
  - `GET /api/sites/{id}/analytics`
  - Verify the site belongs to a project owned by the current user.
  - Return site identity, area, ordered metric periods, and latest KPIs.
- [x] Return periods in ascending chronological order.
- [x] Return `null` KPI values when a metric is unavailable instead of inventing values.
- [x] Reject or validate biodiversity scores outside `0–100`.
- [x] Add response schemas and clear API error responses.

### 4.3 Analytics UI

- [x] Open a site analytics panel when a site is selected.
- [x] Show site name and hectares in the panel header.
- [x] Add latest carbon KPI with `tonnes CO2e` units.
- [x] Add latest biodiversity KPI with `/100` units.
- [x] Add a Chart.js time-series chart for carbon and biodiversity metrics.
- [x] Label every axis, value, unit, and time period.
- [x] Add loading, API error, and no-data states.
- [x] Keep the current project/map context when opening and closing analytics.
- [x] Ensure light and dark themes style the panel and chart consistently.
- [x] Do not communicate metric status through color alone; status includes text and directional labels.

### 4.4 Tests and acceptance

- [x] Add model/migration coverage for the unique site-period constraint.
- [x] Add seed idempotency tests.
- [x] Add analytics response ordering tests.
- [x] Add authenticated ownership/isolation tests.
- [x] Add latest KPI selection tests.
- [x] Add empty metrics response tests.
- [x] Add frontend analytics UI smoke coverage for loading, populated, and empty states through the documented manual smoke path.
- [x] Verify the full backend suite with PostGIS, integration suite, frontend lint, and production build.

### 4.5 Recommended implementation order

1. Add the model, migration, and response schemas.
2. Add seed data and backend analytics endpoint.
3. Add backend tests and verify ownership/ordering/empty states.
4. Add the site analytics panel and KPI cards.
5. Add the Chart.js trend visualization and theme states.
6. Add frontend smoke coverage and run the complete quality gate.

### Phase 4 non-goals

- Scientific carbon accounting or certification.
- Remote sensor/provider integrations.
- Editing or importing metric observations.
- Advanced reporting, exports, or filtering.

## Phase 5 — Delivery

- [x] Add production migration command.
- [x] Verify PostGIS deployment database.
- [x] Deploy API.
- [x] Deploy frontend.
- [x] Configure production CORS.
- [ ] Configure restricted Mapbox token.
- [x] Add deployment health check.
- [ ] Run reviewer smoke test against deployed API and frontend.
- [ ] Capture screenshots or demo recording.
- [x] Complete README deployment notes.
- [ ] Prepare Word submission document.
- [x] Add live demo URL.
- [ ] Grant private repository access if needed.

## Deferred from MVP

- [-] Polygon editing.
- [-] Polygon deletion.
- [-] Team sharing and roles.
- [-] GIS import/export.
- [-] Live sensor integrations.
- [-] Scientific carbon accounting.
- Advanced reporting beyond current analytics filters and CSV export.
- [-] Native mobile app.
- [-] Real-time collaboration.

## Validation record

- [x] Frontend ESLint passes locally.
- [x] Prettier format check passes locally.
- [x] Ruff backend lint passes locally.
- [x] Backend pytest passes locally: 9 passed, 1 PostGIS integration test skipped when unavailable.
- [ ] GitHub Actions run passes after workflow cleanup.
- [x] PostGIS integration test passes locally with the PostGIS service.

Warnings cleaned: application now uses timezone-aware timestamps, PyJWT, and a compatible AnyIO version. Current local quality run is clean.
