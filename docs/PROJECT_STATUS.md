# Project Status

Last updated: 2026-10-29

## Current working state
**Planning phase. No application code exists.** There is no `client/`, no `server/src`, no SQL file, no running app, and no test has been run. Phase 0 (documentation) is in progress and waiting for the author's review.

## What exists (verified by inspecting the repository on 2026-10-28)
- Git repository on `main` with one commit ("Initial CampusMate project baseline"); remote `origin` is set to a GitHub repository. The Phase 0 changes below are **uncommitted**.
- Documentation: README, PRD, architecture, database, api-spec, security, DECISIONS, TASKS, TESTING, CHANGELOG, this file, and planning.
- `server/.env.example` (moved from the repo root) and a `.gitignore` that ignores `.env`, `node_modules/`, and `client/dist/`.

## Environment (checked 2026-10-28)
| Tool | Result |
|---|---|
| Node.js | v24.18.0 |
| npm | 11.16.0 |
| Git | 2.55.0 |
| Database | MySQL Server 8.4.13 (Windows service `MySQL84`, Running, port 3306) plus Workbench, verified 2026-10-29. Client: `C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe` (not on PATH). XAMPP MariaDB is not used. See D-021 (supersedes D-019); OQ-20 closed |

## Known issues and risks
- The database is MySQL 8.4.13 (D-021), matching the brief. Service and server version are verified; the `campusmate` database, the `campusmate_app` user, schema, and session-store compatibility are **unverified** until T-020. Your MySQL `root` login has not been checked.
- OQ-12: it is unknown what stack the submitted faculty proposal named (the 26 Oct deadline has passed). If it said vanilla JS, mention the move to React in the report.
- The schedule assumes about 4 focused hours per day (an assumption, not confirmed).
- All security controls in `security.md` are planned only; none is implemented or verified.
- Docs were cross-checked by reading and text search only; no code exists to compare them against.

## Single best next action
Review the Phase 0 documentation, then commit it (`git add -A`, `git commit -m "docs: revise for React + Vite, add missing docs"`, tag `cp0-docs`, push). After that, start T-010 (server scaffold) and T-020 (database), beginning by confirming the `MySQL84` service is Running (`Get-Service MySQL84`).

## Schedule
See [planning.md](planning.md). Target: MVP complete and tested by Wed 4 Nov, submission Thu 5 Nov 2026.
