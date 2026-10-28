# Decisions and Open Questions

Last updated: 2026-10-25

Status values: **Accepted** (fixed by project instructions or author), **Proposed** (my recommendation, awaiting author approval).

## Decisions
| ID | Decision | Why | Status |
|---|---|---|---|
| D-001 | Stack: HTML/CSS/vanilla JS, Node.js + Express, MySQL via `mysql2`, bcrypt + server-side sessions, Git/GitHub | Fixed by project instructions | Accepted |
| D-002 | Multi-page frontend (`login.html`, `register.html`, `dashboard.html`) served by Express, not a single-page app | Simplest to build and explain; no router needed | Proposed |
| D-003 | Subjects are a separate per-user table; each task requires a subject | Clean filtering, no typo duplicates | Proposed |
| D-004 | Login identifier is email (unique) | Familiar, no username rules | Proposed |
| D-005 | `due_date` is a required DATE (no time of day) | Simple overdue logic, matches student deadlines | Proposed |
| D-006 | Overdue / due-soon are computed at query time, not stored | No background job, always correct | Proposed |
| D-007 | Sessions stored in MySQL via `express-mysql-session` | Default MemoryStore leaks memory and loses sessions on restart | Proposed |
| D-008 | Dependencies: runtime `express`, `mysql2`, `express-session`, `express-mysql-session`, `bcryptjs`, `dotenv`; dev `supertest`. No ORM, no frontend framework. `bcryptjs` chosen over `bcrypt` to avoid native build problems on Windows | Minimal set covering the required stack | Proposed (needs approval before install) |
| D-009 | Other users' resources return 404, not 403 | Avoids revealing what exists | Proposed |
| D-010 | Composite foreign key `(subject_id, user_id)` enforces subject ownership in the DB | Defence in depth | Proposed |
| D-011 | No CSRF tokens in MVP; rely on SameSite=Lax + JSON-only API; documented as residual risk | Keeps scope small | Proposed |
| D-012 | Tests use Node's built-in `node:test` with `supertest`; plus manual test sheets | No heavy test framework | Proposed |
| D-013 | Pending = not completed (overdue tasks are a subset of pending) | Avoids confusing disjoint counts | Proposed |

## Open questions (need the author's answer; defaults in brackets are used until answered)
| ID | Question | Default |
|---|---|---|
| OQ-1 | Which Node.js and MySQL versions are installed? | Node LTS, MySQL 8 |
| OQ-2 | Approve the dependency list in D-008? | Do not install until approved |
| OQ-3 | Subjects as a table, required on every task (D-003)? | Yes |
| OQ-4 | Email login (D-004) or username? | Email |
| OQ-5 | Due date only and required (D-005)? | Yes |
| OQ-6 | "Due soon" window length? | 3 days |
| OQ-7 | Should completed tasks be hidden by default on the dashboard? | Show all, filter available |
| OQ-8 | OK to use MySQL session store (D-007)? | Yes |
| OQ-9 | Optional extra packages (`helmet`, `express-rate-limit`)? | Not used |
| OQ-10 | Timezone for "today"? | Server clock, assumed India (IST) |
| OQ-11 | Must the app be deployed online, or is a local demo enough? | Local demo only |
| OQ-12 | What format/length does the faculty proposal need? (It is not part of this doc pack.) | Unknown, please share |
| OQ-13 | Can a subject with tasks be deleted? | No, blocked with a message |
