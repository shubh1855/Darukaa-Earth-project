5.1 Production readiness

- Remove production reliance on `Base.metadata.create_all`.
- Add documented Alembic migration command.
- Verify PostgreSQL/PostGIS migration from clean database.
- Add production startup checklist.
- Confirm environment variables:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `CORS_ORIGINS`
  - `VITE_API_URL`
  - `VITE_MAPBOX_TOKEN`

### 5.2 Deployment configuration

- Choose hosting targets:
  - API: Render, Railway, Fly.io, or Heroku.
  - Frontend: Vercel, Netlify, or Render.
  - Database: managed PostgreSQL with PostGIS.
- Add deployment configuration.
- Configure build/start commands.
- Configure production CORS.
- Configure restricted Mapbox token.
- Keep secrets out of Git.

### 5.3 Health and operational checks

- Health endpoint check.
- Database connectivity check.
- Migration check.
- API smoke test against deployed API.
- Frontend-to-API connectivity check.
- Authentication check.
- Site creation and analytics check.
- Demo metric seed check.

### 5.4 Submission documentation

- Update README with:
  - Architecture.
  - Database schema.
  - Local setup.
  - Deployment setup.
  - CI/CD details.
  - Demo user instructions.
  - Analytics seed instructions.
  - Known limitations.
- Add live demo URL.
- Add repository URL.
- Prepare Word submission document.
- Add reviewer credentials or setup instructions.

### 5.5 Reviewer acceptance path

1. Open live frontend.
2. Register or log in.
3. Create project.
4. Create polygon site.
5. Select site.
6. Seed demo metrics.
7. Review analytics drawer.
8. Test chart filters.
9. Export CSV.
10. Refresh page.
11. Confirm data persists.
12. Confirm unauthorized access is blocked.

## Recommended branch commits

```text
chore: prepare production migration startup
chore: add deployment configuration
fix: harden production CORS and health checks
docs: add deployment and reviewer setup
test: add deployed API smoke workflow
docs: prepare hackathon submission materials
```

## Phase 5 stop condition

Stop after:

- API deployed.
- Frontend deployed.
- PostGIS verified.
- Smoke test passes against live API.
- Reviewer flow passes.
- README and submission document complete.
- Live URL documented.

Next implementation step: production migration/startup safety.
