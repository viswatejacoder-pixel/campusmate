# Project Status

Last updated: 2026-10-29

## Current working state
**Phase 1 in progress.** Phase 0 is committed, tagged `cp0-docs`, and pushed. The T-010 server scaffold is written and partly verified (**uncommitted**); T-020 (database) has not started. There is no `client/`, no `server/sql/schema.sql`, and no `server/.env` yet. `GET /api/health` returning 200 cannot be verified until T-020 creates the `campusmate_app` user and `.env` (ENV-01). Installed and confirmed by `npm ls` (D-022): express 5.3.0, express-session 1.19.0, express-mysql-session 3.0.3, mysql2 3.24.6, bcryptjs 3.0.3, dotenv 18.0.9.

## What exists (git state verified 2026-10-29)
- Git repository on `main`, in sync with `origin/main`: baseline `8bdf2d1` and Phase 0 docs `d070c82` (tag `cp0-docs`).
- Documentation: README, PRD, architecture, database, api-spec, security, DECISIONS, TASKS, TESTING, CHANGELOG, this file, and planning.
- `server/.env.example` (moved from the repo root) and a `.gitignore` that ignores `.env`, `node_modules/`, and `client/dist/`.
- T-010 files (uncommitted): `server/package.json`, `server/package-lock.json`, `server/src/server.js`, `server/src/app.js`, `server/src/config/env.js`, `server/src/config/db.js`.

## Environment (checked 2026-10-28)
| Tool | Result |
|---|---|
| Node.js | v24.18.0 |
| npm | 11.16.0 |
| Git | 2.55.0 |
| Database | MySQL Server 8.4.13 (Windows service `MySQL84`, Running, port 3306) plus Workbench, verified 2026-10-29. Client: `C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe` (not on PATH). XAMPP MariaDB is not used. See D-021 (supersedes D-019); OQ-20 closed |

## Known issues and risks
- The database is MySQL 8.4.13 (D-021), matching the brief. Service and server version are verified; the `campusmate` database, the `campusmate_app` user, schema, and session-store compatibility are **unverified** until T-020. Your MySQL `root` login has not been checked.
- `npm audit` (2026-10-29): `express-mysql-session@3.0.3` bundles its own older `mysql2` (<=3.23.0) with 2 advisories (credential downgrade to a cleartext auth plugin; compressed-protocol DoS). The app's own `mysql2` is 3.24.6 and not affected. Low risk for a local project (no compression, local DB). Decide at T-030: leave it and document it, add an npm `overrides` entry for the nested `mysql2`, or fall back. Do **not** run `npm audit fix --force`: it would downgrade the session store.
- A shell with `NODE_ENV=production` set overrides `server/.env` (dotenv never overrides existing variables) and makes session cookies `secure`, which breaks local HTTP login (security.md section 2). It was set in the tool session used for the T-010 checks, not in the Windows User or Machine environment. Check `$env:NODE_ENV` in your own terminal before T-030.
- OQ-12: it is unknown what stack the submitted faculty proposal named (the 26 Oct deadline has passed). If it said vanilla JS, mention the move to React in the report.
- The schedule assumes about 4 focused hours per day (an assumption, not confirmed).
- All security controls in `security.md` are planned only; none is implemented or verified.
- Docs were cross-checked by reading and text search only; no code exists to compare them against.

## Single best next action
Review the T-010 scaffold (`server/package.json`, `server/src/`), then commit it (`feat(server): scaffold Express app and health endpoint`). Then T-020: create the `campusmate` database and `campusmate_app` user (database.md section 4), create `server/.env` from `.env.example`, write and apply `server/sql/schema.sql`, then run ENV-01 (health 200) and ENV-04. T-010 becomes Done only after ENV-01 passes. Update TASKS, TESTING, and this file at each step so the next agent can resume.

## Schedule
See [planning.md](planning.md). Target: MVP complete and tested by Wed 4 Nov, submission Thu 5 Nov 2026.
