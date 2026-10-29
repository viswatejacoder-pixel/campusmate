# Project Status

Last updated: 2026-10-29

## Current working state
**Phase 1 setup tasks done, awaiting commit.** Phase 0 and T-010 are committed and pushed (`cp0-docs`, `5768206`). T-010 and T-020 are Done (2026-10-29): database `campusmate` and user `campusmate_app` exist, `server/.env` is configured, `GET /api/health` returns 200 (checked by the assistant, `.env` not read), and `server/sql/schema.sql` was applied in Workbench as `campusmate_app`: `users`, `subjects`, `tasks` exist and a re-run is clean (author-reported). The `sessions` table does not exist yet; `express-mysql-session` creates it in T-030. `schema.sql` and these doc updates are **uncommitted**. No `client/` yet. Installed versions confirmed by `npm ls` (D-022): express 5.3.0, express-session 1.19.0, express-mysql-session 3.0.3, mysql2 3.24.6, bcryptjs 3.0.3, dotenv 18.0.9.

## What exists (git state verified 2026-10-29)
- Git repository on `main`, in sync with `origin/main` as of the T-010 push: baseline `8bdf2d1`, Phase 0 docs `d070c82` (tag `cp0-docs`), server scaffold `5768206`. The `server/sql/schema.sql` file and the T-010/T-020 doc updates are uncommitted.
- Documentation: README, PRD, architecture, database, api-spec, security, DECISIONS, TASKS, TESTING, CHANGELOG, this file, and planning.
- `server/.env.example` (moved from the repo root) and a `.gitignore` that ignores `.env`, `node_modules/`, and `client/dist/`.
- T-010 files (committed in `5768206`): `server/package.json`, `server/package-lock.json`, `server/src/server.js`, `server/src/app.js`, `server/src/config/env.js`, `server/src/config/db.js`.

## Environment (checked 2026-10-28)
| Tool | Result |
|---|---|
| Node.js | v24.18.0 |
| npm | 11.16.0 |
| Git | 2.55.0 |
| Database | MySQL Server 8.4.13 (Windows service `MySQL84`, Running, port 3306) plus Workbench, verified 2026-10-29. Client: `C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe` (not on PATH). XAMPP MariaDB is not used. See D-021 (supersedes D-019); OQ-20 closed |

## Known issues and risks
- The database is MySQL 8.4.13 (D-021), matching the brief. Service and server version are verified, and the `campusmate` database and `campusmate_app` user exist and connect (health 200, 2026-10-29). The schema is applied and re-runs cleanly (T-020). Session-store compatibility (`express-mysql-session` on MySQL 8.4, and the `CREATE` grant being enough for its table) is **unverified** until it is wired in T-030.
- `npm audit` (2026-10-29): `express-mysql-session@3.0.3` bundles its own older `mysql2` (<=3.23.0) with 2 advisories (credential downgrade to a cleartext auth plugin; compressed-protocol DoS). The app's own `mysql2` is 3.24.6 and not affected. Low risk for a local project (no compression, local DB). Decide at T-030: leave it and document it, add an npm `overrides` entry for the nested `mysql2`, or fall back. Do **not** run `npm audit fix --force`: it would downgrade the session store.
- A shell with `NODE_ENV=production` set overrides `server/.env` (dotenv never overrides existing variables) and makes session cookies `secure`, which breaks local HTTP login (security.md section 2). It was set in the tool session used for the T-010 checks, not in the Windows User or Machine environment. Check `$env:NODE_ENV` in your own terminal before T-030.
- OQ-12: it is unknown what stack the submitted faculty proposal named (the 26 Oct deadline has passed). If it said vanilla JS, mention the move to React in the report.
- The schedule assumes about 4 focused hours per day (an assumption, not confirmed).
- All security controls in `security.md` are planned only; none is implemented or verified.
- Docs were cross-checked by reading and text search only; no code exists to compare them against.

## Single best next action
Commit `server/sql/schema.sql` and the doc updates (`feat(server): add MySQL schema`), tag `cp1-setup`, and push. Before T-030: record the ENV-06 result (`SELECT VERSION(), CURRENT_USER();` as `campusmate_app`), check `$env:NODE_ENV` in your own terminal, and decide the nested `mysql2` audit item. Then start T-030 (auth API with MySQL-backed sessions; it also verifies the `sessions` table). Update TASKS, TESTING, and this file at each step so the next agent can resume.

## Schedule
See [planning.md](planning.md). Target: MVP complete and tested by Wed 4 Nov, submission Thu 5 Nov 2026.
