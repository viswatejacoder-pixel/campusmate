# CampusMate

A responsive personal task manager for students: register, log in, and track academic tasks by subject, deadline, and priority.

> **Status (2026-11-03): In development.** The backend (auth with email verification, subjects, tasks) and the client auth flow (register, check email, verify, login, protected routes) are implemented. Email verification (T-075) is done and passed a manual end-to-end test with real Brevo mail. The dashboard (T-080: summary, task list with create, edit, complete and delete, subject management, filters) is implemented and passed automated and manual browser acceptance tests. Responsive polish (T-090), the full test run (T-100) and the clean-clone setup check (T-110) are still to do; T-030 stays open until its manual DevTools cookie check. See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for the current state and [docs/planning.md](docs/planning.md) for the roadmap and schedule.

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

**Production-style run:** `cd client && npm run build`, then `cd server && npm start`. Express serves the built client and the API on `http://localhost:3000`. For a local demo over plain HTTP keep `NODE_ENV=development`; see [docs/security.md](docs/security.md) section 2.

### Free demo deployment

The repository includes [`render.yaml`](render.yaml) for one same-origin Render web service. It builds the Vite client, serves it from Express, and keeps `/api` requests and session cookies first-party. Render provides HTTPS and sets `PORT` automatically; the Blueprint opts into one trusted proxy hop and MySQL TLS. Render's free service sleeps after inactivity and is suitable for a demo, not a production SLA.

For the database, provision a separate MySQL-compatible managed instance and set its connection values in Render's environment settings. Apply [`server/sql/schema.sql`](server/sql/schema.sql) to a new database, then apply `server/sql/migrations/001_email_verification.sql` and `server/sql/migrations/002_password_reset.sql` in that order when upgrading an existing schema. Do not upload the local database or reuse local credentials. Set `APP_BASE_URL` to the final HTTPS service URL and keep `MAIL_TRANSPORT=brevo` with a verified sender.

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
| `DB_SSL` | no | `false` | Set `true` when the managed database requires TLS |
| `SESSION_SECRET` | yes | *(random, 32+ chars)* | Signs session cookies |
| `SESSION_MAX_AGE_HOURS` | no | `8` | Session lifetime |
| `MAIL_TRANSPORT` | email verification | `console` or `brevo` | `console` prints the verification link to the server console (development only, refused in production); `brevo` sends real email |
| `APP_BASE_URL` | email verification | `http://localhost:5173` | Client base URL used in the emailed link |
| `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `BREVO_API_KEY` | only for `brevo` | *(your values)* | Sender verified in Brevo and the Brevo API key |
| `RATE_LIMIT_DISABLED` | no | *(empty)* | Test servers only (ignored in production): `true` switches rate limiting off |

**Brevo (real email):** the public IP of the machine running the server must be on Brevo's authorised IP list, otherwise the Brevo API rejects the request; if your IP changes, authorise the new one. Brevo Transactional Logs show a sent email only after a delay.

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
