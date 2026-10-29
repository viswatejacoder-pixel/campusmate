# Changelog

All notable changes to the project. Newest first. Only things that actually happened are listed.

## 2026-10-29
- T-020 Done: wrote `server/sql/schema.sql` from `database.md` (table definitions identical to the doc, plus `USE campusmate;`). The author applied it in MySQL Workbench as `campusmate_app`: `users`, `subjects`, `tasks` exist and a re-run is clean (ENV-04 Pass, author-reported). ENV-06 stays Partial (the `SELECT VERSION(), CURRENT_USER()` result is not recorded). The session-store table check moved from T-020 to T-030 (TASKS criteria edited accordingly).
- T-010 Done: ENV-01 passes (health 200 with `campusmate_app` connected to `campusmate`) and ENV-05 passes after commit `5768206`. T-020 started: the author created the `campusmate` database and `campusmate_app` user and configured `server/.env` (not inspected by the assistant). `server/sql/schema.sql` does not exist yet, so ENV-04 has not run and T-020 stays In Progress.
- Phase 0 committed (`d070c82`), tagged `cp0-docs`, and pushed by the author.
- T-010 (code committed as `5768206`): created `server/package.json` (ES modules, D-023) and installed the D-008 packages at the D-022 versions; wrote `config/env.js` (fail-fast validation), `config/db.js` (pool, `dateStrings`), `app.js` (health, JSON 404 for `/api`, serves `client/dist` when built, D-020), `server.js`. ENV-02 and ENV-03 pass; ENV-01 waits for T-020; ENV-05 partial. `npm audit` flagged a nested `mysql2` in `express-mysql-session` (see PROJECT_STATUS).
- Docs: corrected the database finding. MySQL Server 8.4.13 (service `MySQL84`, running) is installed; the 2026-10-28 note that only XAMPP MariaDB existed was wrong. D-019 superseded by D-021; OQ-20 closed. Updated README, architecture, database, PRD, security, TASKS, DECISIONS, TESTING (ENV-06), planning.
- Docs: added D-022 (package versions) and D-023 (ES modules), both proposed defaults; added the Phase 1 start sheet to `planning.md`; refreshed `PROJECT_STATUS.md`.
- Incident: a faulty edit script emptied nine uncommitted doc files (architecture, CHANGELOG, database, DECISIONS, planning, PRD, security, TASKS, TESTING). They were rebuilt from editor history and the recorded file-write history, so they should match the 2026-10-28 content plus the corrections above. Review `git diff` before committing.

## 2026-10-28
- Docs: revised for the React + Vite decision (README, PRD, architecture, database, api-spec, security, DECISIONS).
- Docs: added `planning.md`, `TASKS.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`, `TESTING.md`.
- Docs: recorded the environment check (Node v24.18.0, MariaDB 10.4.32 via XAMPP) and the resulting decision D-019 / OQ-20 (later corrected, see 2026-10-29).
- Config: moved `.env.example` from the repo root to `server/.env.example`; added `client/dist/` to `.gitignore`.
- Decisions: D-014 to D-020 recorded; earlier proposed decisions accepted ("defaults are fine").

## 2026-10-25 (date taken from the original documents' headers)
- Initial documentation pack drafted (README, PRD, architecture, database, api-spec, security, DECISIONS) and committed as "Initial CampusMate project baseline".
