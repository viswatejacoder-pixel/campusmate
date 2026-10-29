# CampusMate

A responsive personal task manager for students: register, log in, and track academic tasks by subject, deadline, and priority.

> **Status (2026-10-29): Planning phase. No application code exists yet.** Phase 0 documentation is complete and verified; Phase 1 (server and database setup) is next. See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for the current state and [docs/planning.md](docs/planning.md) for the roadmap and schedule.

B.Tech Web Development minor project.

## Features (MVP scope)
- Student registration, login, logout
- Personal dashboard with pending / completed / overdue summaries
- Create, view, edit, delete, and complete tasks
- Organize tasks by subject; set deadline and priority
- Search and filter by subject, due date, priority, status
- Overdue and due-soon indicators
- Responsive layout (desktop and mobile)
- Server-side validation and persistent database storage

Out of scope: attendance, university/LMS integrations, collaboration, AI features, email notifications.

## Tech stack
React + Vite (plain JavaScript, plain CSS, `react-router-dom`) with `fetch`/JSON | Node.js + Express | MySQL-compatible database via `mysql2` | bcrypt-hashed passwords + server-side sessions | Git/GitHub.
Dependencies are limited to the list approved in [docs/DECISIONS.md](docs/DECISIONS.md) (D-008).

## Repository layout (planned)
```
client/   React + Vite frontend
server/   Express API, SQL scripts, .env.example
docs/     Documentation pack
```
Details: [docs/architecture.md](docs/architecture.md).

## Prerequisites
Versions checked on the author's machine on 2026-10-29:
- Node.js v24.18.0 (npm 11.16.0). Any current Node LTS that satisfies Vite's minimum version should work; check Vite's requirement when installing.
- Database: **MySQL Server 8.4.13** (Windows service `MySQL84`, port 3306) plus MySQL Workbench. The command-line client is `C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe` (not on PATH). XAMPP's MariaDB is also installed but is **not used** (D-021); keep XAMPP's MySQL module stopped so it does not clash on port 3306.
- Git 2.55.0

## Setup (PLANNED - will be verified in task T-110; do not rely on it until then)
1. `git clone <repo-url>` and `cd campusmate`
2. Install server packages: `cd server && npm install`
3. Install client packages: `cd ../client && npm install`
4. Make sure the MySQL 8.4 service is running, then create the database and a limited-privilege user: see "Local database setup" in [docs/database.md](docs/database.md). The client is `C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe` (not on PATH).
5. Apply the schema (PowerShell has no `<` redirection): `Get-Content server\sql\schema.sql | & "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u <admin-user> -p campusmate`
6. Copy `server/.env.example` to `server/.env` and fill in values (table below)
7. Terminal 1: `cd server && npm run dev` (API on `http://localhost:3000`)
8. Terminal 2: `cd client && npm run dev`, then open `http://localhost:5173`

In development the Vite server forwards `/api` requests to Express, so the browser only talks to port 5173.

**Production-style run (planned, D-020):** `cd client && npm run build`, then `cd server && npm start`. Express serves the built client and the API on `http://localhost:3000`. For a local demo over plain HTTP keep `NODE_ENV=development`; see [docs/security.md](docs/security.md) section 2.

## Environment variables (server only, in `server/.env`)
| Variable | Required | Example / default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `production` turns on secure cookies (HTTPS hosting only) |
| `PORT` | no | `3000` | API port |
| `DB_HOST` | yes | `localhost` | Database host |
| `DB_PORT` | no | `3306` | Database port |
| `DB_NAME` | yes | `campusmate` | Database name |
| `DB_USER` | yes | `campusmate_app` | Database user (not root) |
| `DB_PASSWORD` | yes | *(your value)* | Database password |
| `SESSION_SECRET` | yes | *(random, 32+ chars)* | Signs session cookies |
| `SESSION_MAX_AGE_HOURS` | no | `8` | Session lifetime |

The server must refuse to start if a required variable is missing. Real values live only in `server/.env`, which is git-ignored. The client needs no environment variables, and nothing secret may ever be put in a `VITE_` variable because those end up in the browser bundle.

## Scripts (PLANNED)
`server`: `npm start` run API | `npm run dev` run with auto-restart (`node --watch`)
`client`: `npm run dev` Vite dev server | `npm run build` production build | `npm run preview` serve the build
Testing is manual-first; see [docs/TESTING.md](docs/TESTING.md).

## Documentation
| Doc | Purpose |
|---|---|
| [docs/planning.md](docs/planning.md) | Roadmap, phases, and schedule to 5 Nov 2026 |
| [docs/PRD.md](docs/PRD.md) | Requirements and acceptance criteria |
| [docs/architecture.md](docs/architecture.md) | Structure, layers, request flow |
| [docs/database.md](docs/database.md) | Schema and queries |
| [docs/api-spec.md](docs/api-spec.md) | REST API contract |
| [docs/TASKS.md](docs/TASKS.md) | Task tracker |
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Current state and next action |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decisions and open questions |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Change history |
| [docs/security.md](docs/security.md) | Security rules and risks |
| [docs/TESTING.md](docs/TESTING.md) | Test plan and evidence rules |
