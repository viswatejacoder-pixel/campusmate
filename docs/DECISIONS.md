# Decisions and Open Questions

Last updated: 2026-10-29

Status values: **Accepted** (fixed by project instructions or approved by the author), **Proposed** (my recommendation, awaiting author confirmation), **Superseded** (replaced by a later decision; kept for history).
On 2026-10-28 the author said "defaults are fine", which accepts every decision below that was previously Proposed and every default answer in the question table, except where a row says otherwise.

## Decisions
| ID | Decision | Why | Status |
|---|---|---|---|
| D-001 | Stack: Node.js + Express, MySQL-compatible database via `mysql2`, bcrypt + server-side sessions, Git/GitHub. Frontend was originally HTML/CSS/vanilla JS; replaced by D-014 | Fixed by project instructions | Accepted (frontend part superseded by D-014; database engine see D-021) |
| D-002 | Multi-page frontend served by Express, not a single-page app | Was the simplest option with vanilla JS | Superseded by D-014 and D-017 |
| D-003 | Subjects are a separate per-user table; each task requires a subject | Clean filtering, no typo duplicates | Accepted |
| D-004 | Login identifier is email (unique) | Familiar, no username rules | Accepted |
| D-005 | `due_date` is a required DATE (no time of day) | Simple overdue logic, matches student deadlines | Accepted |
| D-006 | Overdue / due-soon are computed at query time, not stored | No background job, always correct | Accepted |
| D-007 | Sessions stored in the database via `express-mysql-session` | Default MemoryStore leaks memory and loses sessions on restart | Accepted (compatibility with MySQL 8.4 checked in T-020) |
| D-008 | Dependencies, kept minimal. `server/` runtime: `express`, `mysql2`, `express-session`, `express-mysql-session`, `bcryptjs`, `dotenv`. `client/` runtime: `react`, `react-dom`, `react-router-dom`; dev: `vite`, `@vitejs/plugin-react`. No ORM, no UI library, no state library, no testing library, no `nodemon`/`concurrently`/`helmet`/rate limiter. `bcryptjs` chosen over `bcrypt` to avoid native build problems on Windows. Exact versions are recorded when installed | Minimal set for the chosen stack | Accepted 2026-10-28. Any package beyond this list needs a new approval |
| D-009 | Other users' resources return 404, not 403 | Avoids revealing what exists | Accepted |
| D-010 | Composite foreign key `(subject_id, user_id)` enforces subject ownership in the DB | Defence in depth | Accepted (verified on MySQL 8.4 in T-020) |
| D-011 | No CSRF tokens in MVP; rely on SameSite=Lax + JSON-only API; documented as residual risk | Keeps scope small | Accepted |
| D-012 | Tests use Node's built-in `node:test` with `supertest`; plus manual test sheets | Was a light automated setup | Superseded by D-018 |
| D-013 | Pending = not completed (overdue tasks are a subset of pending) | Avoids confusing disjoint counts | Accepted |
| D-014 | Frontend is **React + Vite** (plain JavaScript, plain CSS) instead of vanilla JS. Plain-JS helper layers (`api/`, `utils/`) hold the `fetch` calls and date/validation logic | Author decision, 2026-10-28; React suits the dynamic dashboard (filters, summaries). Note: the original brief specified vanilla JS | Accepted |
| D-015 | In development, the Vite dev server proxies `/api` to Express | Author decision, 2026-10-28. One origin means no CORS and simple session cookies | Accepted |
| D-016 | One repository with separate `client/` and `server/` folders, each with its own `package.json` | Author decision, 2026-10-28 | Accepted |
| D-017 | Single-page app with `react-router-dom` for `/login`, `/register`, `/dashboard` | Author approved it "if needed" (2026-10-28). It is needed for three routes; client-side route guarding is UX only, the server enforces access | Accepted |
| D-018 | Testing: manual test cases documented in `docs/TESTING.md` with recorded evidence. No testing dependencies. Optional scripted API checks may use Node's built-in `node:test` and `fetch` (no install) | Author decision, 2026-10-28 | Accepted |
| D-019 | Database engine: the installed server is **XAMPP's MariaDB 10.4.32**, not MySQL 8.x. Plan: keep using it as a MySQL-compatible server (same `mysql2` driver, same SQL), and verify the schema and session store on it in T-020. If anything fails there, the alternative is to install MySQL 8 | MariaDB is already installed and avoids a new install on a tight deadline. The project brief says "MySQL"; the report and viva should state honestly that MariaDB was used | Superseded by D-021 (2026-10-29) |
| D-020 | In a production build Express serves `client/dist` (static files, plus a fallback to `index.html` for non-`/api` GET requests so React routes survive a refresh), enabled when `client/dist/index.html` exists. Unknown `/api` paths still return a JSON 404. Needs no new package. The cookie `secure` flag follows `NODE_ENV` only (see security.md section 2) | Author asked for this "if feasible". It uses only `express.static` and one fallback route, so it is feasible; it is verified in T-110 | Accepted (feasibility confirmed by design, not yet tested) |
| D-021 | Database engine: **MySQL Server 8.4.13** (Windows service `MySQL84`, found running 2026-10-29, with Workbench). Use it with `mysql2`; XAMPP's MariaDB is left unused and stopped | The brief specifies MySQL. The 2026-10-28 check only looked at XAMPP and missed this install, which led to D-019 | Accepted (matches the project stack; supersedes D-019) |
| D-022 | Package versions: use the current stable majors npm reports on 2026-10-29 (express 5.3.0, express-session 1.19.0, express-mysql-session 3.0.3, mysql2 3.24.6, bcryptjs 3.0.3, dotenv 18.0.9, react and react-dom 19.3.1, react-router-dom 7.18.5, vite 8.3.5, @vitejs/plugin-react 6.1.2). None declares a Node limit that excludes Node 24.18.0 (Vite and its React plugin need Node 20.19+ or 22.12+). Exact installed versions are recorded in PROJECT_STATUS when installed. If `express-mysql-session` or `express-session` misbehaves on Express 5 during T-020/T-030, fall back to Express 4 and record it here | Same package list as D-008, only versions chosen. Express 5 is the current release line | Proposed (default applies unless you object) |
| D-023 | Server code uses ES modules (`"type": "module"` in `server/package.json`, `import`/`export`), like the client. Scripts: `"start": "node src/server.js"`, `"dev": "node --watch src/server.js"`. `dotenv` is loaded in `config/env.js`, which is imported before anything that reads `process.env` | One module style across the project; Node 24 supports it natively | Proposed (default applies unless you object) |

## Resolved questions
| ID | Question | Answer |
|---|---|---|
| OQ-1 | Installed Node.js and database versions? | Checked on 2026-10-29: Node.js v24.18.0, npm 11.16.0, Git 2.55.0. Database: MySQL Server 8.4.13 (service `MySQL84` running; client not on PATH, full path in README). The 2026-10-28 check found only XAMPP MariaDB 10.4.32 and missed this install. See D-021 |
| OQ-2 | Approve the dependency list? | Yes, D-008 |
| OQ-3 | Subjects as a required table (D-003)? | Yes |
| OQ-4 | Email login? | Yes |
| OQ-5 | Required due date, no time? | Yes |
| OQ-6 | "Due soon" window? | 3 days |
| OQ-7 | Hide completed tasks by default? | No, show all, filter available |
| OQ-8 | MySQL session store? | Yes |
| OQ-9 | Extra packages (`helmet`, rate limiting)? | Not used |
| OQ-10 | Timezone for "today"? | Server clock, assumed India (IST) |
| OQ-11 | Deployed online or local demo? | Local demo only (default); hosting only if later required |
| OQ-13 | Can a subject with tasks be deleted? | No, blocked with a message |
| OQ-14 | Demo mode? | Two dev servers with the Vite proxy for development; Express serves the built client for production if feasible (D-020) |
| OQ-15 | Move `.env.example` into `server/`, ignore `client/dist/`? | Approved and done on 2026-10-28 |
| OQ-16 | Plain JavaScript or TypeScript? | Plain JavaScript |
| OQ-17 | Styling? | Plain CSS files |
| OQ-18 | Extra client packages? | Only `react-router-dom` beyond React, ReactDOM and Vite |
| OQ-19 | Dev convenience? | `node --watch`, two terminals, no extra packages |
| OQ-20 | Keep XAMPP's MariaDB or use MySQL 8? | Moot: MySQL Server 8.4.13 is installed and running (D-021); MariaDB is not used |

## Open questions
| ID | Question | Default until answered |
|---|---|---|
| OQ-12 | What format/length did the faculty proposal need, and what stack did the submitted proposal state? (The 26 Oct deadline has passed; the proposal is not part of this doc pack.) | Unknown, please share |
