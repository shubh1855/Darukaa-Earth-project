# Darukaa.Earth Progress

**Last updated:** 2026-09-17  
**Target:** MVP ready for review by tomorrow evening

## Status summary

| Phase | Scope                                | Status   |
| ----- | ------------------------------------ | -------- |
| 0     | Repository, tooling, CI, local setup | Complete |
| 1     | Authentication API and UI            | Complete |
| 2     | Project creation, listing, ownership | Complete |
| 3     | PostGIS sites and Mapbox polygons    | Next     |
| 4     | Site analytics and metrics chart     | Planned  |
| 5     | Deployment, submission, final QA     | Planned  |

## Completed

### Repository foundation

- Monorepo structure created.
- Product specification created in `docs/PROJECT-SPEC.md`.
- Implementation guide created in `docs/IMPLEMENTATION.md`.
- README contains setup and quality commands.
- GitHub Actions workflow exists for frontend, backend, and PostGIS integration checks.
- Husky and lint-staged pre-commit hook enabled.
- `uv` manages backend dependencies through `backend/pyproject.toml` and `backend/uv.lock`.
- Ruff provides Python lint and formatting.

### Authentication

- Registration endpoint: `POST /api/auth/register`.
- Login endpoint: `POST /api/auth/login`.
- Current-user endpoint: `GET /api/auth/me`.
- JWT bearer authentication.
- Argon2 password hashing through `pwdlib`.
- Duplicate email and invalid credential handling.
- Frontend login and registration screen.
- Logout and browser token persistence.

### Projects

- `Project` model with owner relationship.
- `GET /api/projects` lists only authenticated user's projects.
- `POST /api/projects` creates owned project.
- Project name and description validation.
- Frontend create form and project list.
- Empty, loading, and error states.
- Tests cover project creation, authentication, and cross-user isolation.

## Validation completed

```text
Frontend ESLint: passed
Prettier format check: passed
Ruff backend lint: passed
Backend pytest: 6 passed
```

Warnings remain from upstream dependencies using deprecated `datetime.utcnow`; they do not fail the current checks.

## Next work: Phase 3

### Backend

1. Add `Site` model and PostGIS geometry column.
2. Add Alembic configuration and initial migrations.
3. Add GeoJSON request and response schemas.
4. Validate Polygon type and closed linear rings.
5. Add project ownership checks for site routes.
6. Calculate area with projected PostGIS geometry.
7. Add `GET /api/projects/{id}/sites`.
8. Add `POST /api/projects/{id}/sites`.
9. Add `GET /api/sites/{id}` placeholder or detail response.
10. Add unit tests with geometry fixtures and integration tests against PostGIS.

### Frontend

1. Add Mapbox token handling and map component.
2. Add Mapbox Draw control.
3. Add site-name form after polygon draw.
4. Save polygon through API.
5. Render saved polygons as GeoJSON layers.
6. Add site list and selection state.
7. Display area in hectares.

### Done criteria

- User can select a project.
- User can draw valid polygon.
- Invalid polygon cannot be submitted.
- Saved site survives refresh.
- Site is visible on map after refresh.
- User cannot read another user's project sites.
- Backend and frontend checks pass.

## Deferred work

- Polygon editing and deletion.
- Team sharing and roles.
- Data import/export.
- Live sensor integrations.
- Scientific carbon accounting.
- Advanced filtering and reports.
