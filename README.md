# CampusMate

A responsive personal task manager for students: register, log in, and track academic tasks by subject, deadline, and priority.

> **Status (2026-10-25): Planning phase. No application code exists yet.** See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for the current state.

B.Tech Web Development minor project.

## Features (MVP scope)
- Student registration, login, logout
- Personal dashboard with pending / completed / overdue summaries
- Create, view, edit, delete, and complete tasks
- Organize tasks by subject; set deadline and priority
- Search and filter by subject, due date, priority, status
- Overdue and due-soon indicators
- Responsive layout (desktop and mobile)
- Server-side validation and persistent MySQL storage

Out of scope: attendance, university/LMS integrations, collaboration, AI features, email notifications.

## Tech stack
HTML5, CSS3 (Flexbox/Grid), vanilla JavaScript (Fetch API, JSON) | Node.js + Express | MySQL (`mysql2`) | bcrypt-hashed passwords + server-side sessions | Git/GitHub.
Dependency list is **proposed, pending approval**: see [docs/DECISIONS.md](docs/DECISIONS.md).

## Prerequisites
- Node.js (LTS; exact version to be recorded, see open question OQ-1)
- MySQL 8.x (running locally)
- Git

## Setup (PLANNED - will be verified in task T-080; do not rely on it until then)
1. `git clone <repo-url>` and `cd campusmate`
2. `npm install`
3. Create the database and a limited-privilege user: see "Local MySQL setup" in [docs/database.md](docs/database.md)
4. Apply the schema: `mysql -u <admin-user> -p campusmate < sql/schema.sql`
5. Copy `.env.example` to `.env` and fill in values (table below)
6. `npm start` (or `npm run dev`), then open `http://localhost:3000`

## Environment variables
| Variable | Required | Example / default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `production` turns on secure cookies |
| `PORT` | no | `3000` | HTTP port |
| `DB_HOST` | yes | `localhost` | MySQL host |
| `DB_PORT` | no | `3306` | MySQL port |
| `DB_NAME` | yes | `campusmate` | Database name |
| `DB_USER` | yes | `campusmate_app` | Database user (not root) |
| `DB_PASSWORD` | yes | *(your value)* | Database password |
| `SESSION_SECRET` | yes | *(random, 32+ chars)* | Signs session cookies |
| `SESSION_MAX_AGE_HOURS` | no | `8` | Session lifetime |

The server must refuse to start if a required variable is missing. Real values live only in `.env`, which is git-ignored.

## Scripts (PLANNED)
`npm start` run server | `npm run dev` run with auto-restart | `npm test` run automated tests

## Documentation
| Doc | Purpose |
|---|---|
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
