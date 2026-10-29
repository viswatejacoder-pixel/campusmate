# Task Tracker

Last updated: 2026-10-29

Status values: Todo, In Progress, Blocked, Done. A task is **Done only after its verification criteria were checked and the result recorded** in [TESTING.md](TESTING.md) or `PROJECT_STATUS.md`. Phases, dates, and Git checkpoints are in [planning.md](planning.md).
Priority: High = core (Tier 1), Medium = required but after core (Tier 2), Low = first to trim (Tier 3, needs author approval).

| ID | Description | Priority | Status | Dependencies | Verification criteria |
|---|---|---|---|---|---|
| T-001 | Phase 0: revise docs for React + Vite, create the missing docs, move `.env.example` to `server/`, ignore `client/dist/`, record tool versions | High | Done | none | All 12 doc files exist (verified 2026-10-29); README links open (verified); text search finds no unintended stale references (verified); author committed, tagged `cp0-docs`, and pushed (confirmed by author 2026-10-29, commit `d070c82`) |
| T-010 | Server scaffold: `server/` package, env validation, Express app, DB pool, `GET /api/health` | High | Done | T-001 | Health returns 200 with the DB up; server refuses to start with a missing env var; health fails safely with the DB down. All verified 2026-10-29 (ENV-01 to ENV-03, ENV-05 in TESTING.md) |
| T-020 | Database: create DB and limited user, write `server/sql/schema.sql`, apply it; verify on MySQL 8.4 (D-021) | High | Done | T-010 | `SHOW TABLES` lists users, subjects, tasks; schema re-runs without error; app user `campusmate_app` can connect. All confirmed 2026-10-29 (ENV-04, ENV-01; `schema.sql` applied in Workbench as `campusmate_app`, author-reported). The session-store table check (`sessions` created by `express-mysql-session`) moved to T-030 by author decision, because the store is not wired before then |
| T-030 | Auth API: register, login, logout, me; bcrypt; MySQL-backed sessions; `requireAuth` | High | Todo | T-020 | Auth cases in TESTING.md pass: hash starts `$2`, duplicate email 409, generic login error, old cookie 401 after logout, cookie flags correct. Also (moved from T-020): `express-mysql-session` creates the `sessions` table on first run with the `campusmate_app` grants, and the session works on MySQL 8.4 |
| T-040 | Subjects API: list, create, rename, delete (409 when in use) | High | Todo | T-030 | Subject cases in TESTING.md pass, including per-user uniqueness and isolation |
| T-050 | Tasks API: CRUD, complete, summary, computed overdue/due-soon; then filters and sorting | High (CRUD) / Medium (filters) | Todo | T-040 | Task, validation, isolation, unauthorized, and filter cases in TESTING.md pass |
| T-060 | Client scaffold: Vite + React, `react-router-dom`, `/api` proxy, `api/client.js`, `AuthContext` | High | Todo | T-010 (T-030 for full test) | `/api/health` reachable through port 5173; routes render; no CORS errors |
| T-070 | Auth UI: register, login, logout, protected routes, per-field errors | High | Todo | T-030, T-060 | Auth UI cases in TESTING.md pass, including session restore on refresh and redirect to `/login` |
| T-080 | Dashboard UI: summary, task list, create/edit/delete/complete, subjects; then filters and indicators | High (core) / Medium (filters, indicators) | Todo | T-050, T-070 | Dashboard cases in TESTING.md pass; script tag in a title renders as text; second user sees no foreign data |
| T-090 | Responsive layout and polish; loading and error states; screenshots into `docs/evidence/` | Medium | Todo | T-080 | Responsive cases pass at 360 px and desktop; no horizontal scroll |
| T-100 | Full manual test run, security checklist evidence, `npm audit` in both packages | High | Todo | T-090 | Every TESTING.md case has a recorded result; security.md checklist ticked only with evidence |
| T-110 | Clean-clone setup check, production-style run (D-020), final doc consistency pass, submission pack | High | Todo | T-100 | README setup works from a fresh clone; built client served by Express and routes survive refresh; `PROJECT_STATUS.md` matches reality |
