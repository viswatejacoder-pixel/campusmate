# CampusMate Roadmap and Schedule

Last updated: 2026-10-29 | Status: **Plan. No application code exists. Phase 0 (docs) is complete and verified, pending your commit and tag `cp0-docs`; Phase 1 is next and not started.**

Source of truth: the existing docs ([PRD](PRD.md), [architecture](architecture.md), [database](database.md), [api-spec](api-spec.md), [security](security.md), [DECISIONS](DECISIONS.md)). This file sequences the work; it does not change scope. If it disagrees with those docs, the docs win and this file gets corrected.

Stack: React + Vite (client), Node.js + Express (server), MySQL 8.4 via `mysql2` (D-021), bcrypt-hashed passwords (`bcryptjs`), server-side sessions.

## 1. Where the project stands (inspected 2026-10-29)
- Git: one commit on `main` ("Initial CampusMate project baseline"); remote `origin` points to a GitHub repository. Phase 0 changes are not committed yet.
- Repo contains: `README.md`, `.gitignore`, `server/.env.example`, and `docs/` with all required docs plus this file.
- No `client/`, no application code under `server/`, no SQL files.
- Documentation gaps found earlier were fixed in Phase 0 (api-spec note, database/security updates, the four missing docs).
- Environment checked 2026-10-29: Node v24.18.0, npm 11.16.0, Git 2.55.0, **MySQL Server 8.4.13 (service `MySQL84`, running, port 3306)** and MySQL Workbench. The earlier note that only XAMPP MariaDB existed was wrong (D-021).
- Approvals given 2026-10-28: dependency list (D-008), `.env.example` move and `client/dist/` ignore (done), two dev servers plus Express serving the built client (D-020). Still open: OQ-12 (proposal details). D-022 (package versions) and D-023 (ES modules) are proposed defaults. See [DECISIONS](DECISIONS.md).

## 2. Assumptions
- Roughly 4 focused hours on weekdays and more at the weekend. **If you have fewer hours, tell me and the cut line in section 5 moves earlier.** This is a guess, not something you told me.
- Deployment is a local demo only (OQ-11 default). Online hosting is not scheduled; it only happens if you confirm it is required.
- Default answers in DECISIONS apply until you change them.
- The schedule is a plan, not a record. Progress is tracked in `docs/TASKS.md` and `docs/PROJECT_STATUS.md`.

## 3. Priority tiers
Mapped to PRD requirement IDs. Build in this order.

| Tier | Requirements | Meaning |
|---|---|---|
| 1. Core | FR-1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17 | Without these the app is not a working task manager. Build first, test first. |
| 2. Required, after core | FR-11 (search and filter), FR-12 (indicators), FR-13 (summary), FR-14 (responsive) | In approved scope, built once Tier 1 works end to end. |
| 3. First to trim if late | Sort options beyond due date, due-date range filter, free-text search, subject rename, due-soon indicator | Each trim narrows a PRD acceptance criterion, so it needs your approval and a PRD/DECISIONS note. |

## 4. Git checkpoint conventions
- `main` always holds a working or docs-only state. Work on short feature branches (`feat/auth-api`) or directly on `main` if you prefer; either is fine for a solo project.
- Commit after every finished task, with a message like `feat(server): add login endpoint` or `docs: update api-spec`.
- At the end of each phase: run its tests, update docs, commit, **tag** (`cp0-docs` ... `cp8-final`), and `git push` with tags. Confirm the GitHub remote exists before the first push.
- Never commit `.env`, `node_modules/`, or `client/dist/`. Before each checkpoint run `git status` and `git ls-files` and look for them.
- If a phase goes wrong, the last tag is your safe point. Do not rewrite pushed history.

## 5. Schedule (28 Oct to 5 Nov 2026)

| Date | Phase | Target |
|---|---|---|
| Wed 28 Oct | 0 | Finish docs revision, collect approvals, create missing docs |
| Thu 29 Oct | 1, start 2 | Server + database + health check working; begin auth API |
| Fri 30 Oct | 2, start 3 | Auth API done and tested; subjects API |
| Sat 31 Oct | 3 | Tasks API (CRUD, complete, summary, filters) done and tested |
| Sun 1 Nov | 4 | Client scaffold, proxy working, register/login/logout UI, protected routes |
| Mon 2 Nov | 5 | Dashboard: summary, task list, create/edit/delete/complete, subjects |
| Tue 3 Nov | 5, 6, start 7 | Filters and indicators, responsive pass, start manual testing. **Feature freeze at end of day.** |
| Wed 4 Nov | 7, 8 | Full test run, security checklist, bug fixes, screenshots, clean-clone check |
| Thu 5 Nov | 8 | Final check, final tag, submit. No new features. |

**Cut line:** if a day-end target above slips by more than half a day, stop adding Tier 3 items. If Phase 3 is not finished by end of Sat 31 Oct, ask me to apply the Tier 3 trims (with your approval). Never trim authentication, task CRUD, user isolation, validation, persistence, the overdue indicator, or the summary counts.

**Buffer:** Wed 4 Nov is bug-fix and evidence time, not feature time. Thu 5 Nov is for submission only.

## 6. Phases

Testing note: for API steps use the browser DevTools Network tab, or a request tool of your choice (Postman, Thunder Client, or `curl.exe`; none of these is a project dependency). JSON quoting is fiddly in Windows terminals, so keep your test requests in a text file. Record every result, pass or fail, in `docs/TESTING.md` with the date. Use fake users only (for example `asha.test@example.com`).

### Phase 0: Documentation and approvals (T-001) | Wed 28 Oct
**Status: complete and re-verified on 2026-10-29, waiting for your commit and tag.** Nothing is committed yet.
**Goal:** docs match the React + Vite decision and every required doc exists, so coding starts from an accurate base.
**Depends on:** your approvals (given 2026-10-28: defaults, minimal dependencies, config moves, Express serving the built client).

Tasks:
- [x] Add the single-origin and `/api/auth/me` note to `api-spec.md` so its header is true.
- [x] Update `database.md` paths (`server/sql/schema.sql`, `server/.env`) and record the MariaDB finding.
- [x] Update `security.md`: S-5 for React escaping, S-7 for no secrets in `VITE_` variables, checklist items.
- [x] Create `TASKS.md` (IDs T-001 to T-110 from this plan), `PROJECT_STATUS.md`, `CHANGELOG.md`, `TESTING.md` (test cases all marked "Not run").
- [x] Record Node and database versions (OQ-1) in `PROJECT_STATUS.md`.
- [x] Move `.env.example` into `server/`; add `client/dist/` to `.gitignore`; link this file from the README.
- [x] Reconcile the database finding (MySQL 8.4.13, D-021) across all docs (2026-10-29).
- [ ] Your commit and tag `cp0-docs` (commands in the Phase 1 start sheet).

**Deliverables:** 11 doc files (10 required plus this file) and `README.md`, consistent with each other.
**Testing (done 2026-10-28 with a PowerShell text search, not VS Code):** searched README, docs, and server for `vanilla`, `public/`, `supertest`, `innerHTML`, `nodemon`, `sql/` paths, and old open-question references. Remaining hits are intentional (history rows D-001, D-002, D-012, D-014, the "never used" rules, and this file). Checked every relative Markdown link: none broken. Re-run on 2026-10-29 after the MySQL 8.4 correction (results in PROJECT_STATUS).
**Done when:** all 12 files exist, searches show no unintended stale references, every link opens a file, and you have reviewed the docs. The first three are verified; the review is yours.
**Git checkpoint:** `docs: revise for React + Vite, add missing docs`, tag `cp0-docs`.
**Docs updated:** all of the above, `CHANGELOG.md`.

### Phase 1: Project setup (T-010, T-020) | Thu 29 Oct
**Goal:** a running Express server connected to MySQL 8.4 (D-021), with the schema applied.
**Depends on:** Phase 0 committed; approved dependency list for `server/` (D-008, versions D-022); `MySQL84` service running. Follow the start sheet below.

Tasks:
- [ ] Create `server/` package files (`package.json`), install the approved server packages only. (`server/.env.example` already exists; `client/dist/` is already ignored.)
- [ ] Write `server/src/config/env.js` (fails fast on missing variables), `config/db.js`, `app.js` (including the serve-`client/dist`-when-present logic and JSON 404 for unknown `/api` paths, D-020), `server.js`, and `GET /api/health` (checks the DB).
- [ ] Create the MySQL database and the limited-privilege `campusmate_app` user (database.md section 4).
- [ ] Write `server/sql/schema.sql` from database.md and apply it. This is the first real test of the schema and the session store on MySQL 8.4; if anything fails, stop and report the exact error.
- [ ] Create your local `server/.env` (never committed).

**Deliverables:** `server/` skeleton, `schema.sql`, working health endpoint.
**Testing:**
- Start the server: `GET /api/health` returns 200 `{ "status": "ok" }`.
- Remove one required variable from `.env`: server refuses to start with a clear message. Restore it.
- Stop MySQL and call health: response is a safe error, not a stack trace.
- In MySQL: `SHOW TABLES;` lists `users`, `subjects`, `tasks`. Run `schema.sql` a second time: no errors.
- `git status` shows `.env` ignored; `git ls-files` shows no `.env` or `node_modules`.

**Done when:** all five checks pass and are recorded in `TESTING.md`.
**Git checkpoints:** `feat(server): scaffold Express app and health endpoint` (after T-010), `feat(server): add MySQL schema` (after T-020), then tag `cp1-setup`.
**Docs updated:** `TASKS.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`, README setup steps if anything differed, `database.md` if the schema changed.

### Phase 1 start sheet (prepared 2026-10-29; the commands below have NOT been run)
**Verified 2026-10-29:** Node v24.18.0, npm 11.16.0, Git 2.55.0; `MySQL84` service Running with port 3306 listening; MySQL Workbench installed; npm registry reachable. **Not verified (only you can check):** your MySQL `root` login; that the GitHub repository accepts pushes; that no `campusmate` database or `campusmate_app` user exists yet.
**Tools:** VS Code, PowerShell, MySQL Workbench or `mysql.exe` (full path in README). No new installs.
**Files and folders Phase 1 creates** (everything else follows [architecture.md](architecture.md)):
```
server/
  package.json            (created by npm; "type": "module", D-023)
  .env                    (yours, git-ignored, copied from .env.example)
  sql/schema.sql
  src/server.js  src/app.js
  src/config/env.js  src/config/db.js
```
**Environment (`server/.env`):** set `DB_PASSWORD` to the password you choose for `campusmate_app`; set `SESSION_SECRET` from `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; keep `NODE_ENV=development`. Never paste either value into chat or docs.
**Commands (PowerShell, in this order):**
```
# A. Commit Phase 0 (checkpoint cp0-docs)
cd C:\Dev\campusmate
git status --short
git add -A
git commit -m "docs: revise for React + Vite, add missing docs"
git tag cp0-docs
git push origin main --tags

# B. Database service and admin login (then run the SQL in database.md section 4)
Get-Service MySQL84
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -p

# C. Server package (installs only the D-008 list)
cd C:\Dev\campusmate\server
npm init -y
npm pkg set type=module "scripts.start=node src/server.js" "scripts.dev=node --watch src/server.js"
npm install express express-session express-mysql-session mysql2 bcryptjs dotenv
copy .env.example .env
```
Git checkpoints for this phase are listed under Phase 1 below.

### Phase 2: Authentication API (T-030) | Thu 29 Oct to Fri 30 Oct
**Goal:** register, login, logout, and "who am I" with hashed passwords and server-side sessions.
**Depends on:** Phase 1.

Tasks:
- [ ] `AppError` class, `errorHandler`, `notFound`, JSON body limit and JSON-only check (415).
- [ ] Session config with MySQL store (D-007): HttpOnly, `sameSite: 'lax'`, `secure` only in production, max age from env.
- [ ] Auth validator, user model (parameterized SQL), auth controller and routes.
- [ ] `requireAuth` middleware.
- [ ] Register: lower-case/trim email, bcrypt hash, log the user in. Login: generic error, `req.session.regenerate()`. Logout: destroy session. `GET /api/auth/me`.

**Deliverables:** four auth endpoints matching `api-spec.md`.
**Testing:**
- Register valid user: 201, no hash in the response; in MySQL `password_hash` starts with `$2`.
- Duplicate email: 409. Missing fields, bad email, 7-character password: 400 with per-field messages.
- Wrong password and unknown email: the same generic 401 message.
- Login, then `GET /api/auth/me`: 200. Logout, then `/me` with the old cookie: 401.
- Cookie in DevTools shows HttpOnly and SameSite=Lax.
- Send a malformed JSON body and a non-JSON content type: safe 400/415, no stack trace.
- Search the code for any logging of passwords.

**Done when:** every case above passes and is logged.
**Git checkpoint:** `feat(server): auth endpoints with sessions`, tag `cp2-auth-api`.
**Docs updated:** `api-spec.md` if behaviour differs, `security.md` evidence for S-1, S-4, S-8, `TESTING.md`, `TASKS.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`.
**Viva check:** can you explain how a session cookie maps to a user, and why the login error is generic?

### Phase 3: Subjects and Tasks API (T-040, T-050) | Fri 30 Oct to Sat 31 Oct
**Goal:** the full data API with user isolation. Build subjects first, then tasks (Tier 1 before filters).
**Depends on:** Phase 2.

Tasks:
- [ ] Subjects: validator, model, controller, routes (list, create, rename, delete; 409 when in use).
- [ ] Tasks Tier 1: create, get one, update, delete, complete/un-complete, list without filters. Every query includes `user_id` from the session.
- [ ] Register `GET /api/tasks/summary` before `/:id`.
- [ ] Computed `isOverdue` and `isDueSoon` using the server date (OQ-6, OQ-10).
- [ ] Tasks Tier 2: filters and sorting on `GET /api/tasks` (`subjectId`, `priority`, `status`, `q`, `dueFrom`, `dueTo`, `sort`, `order`), with sort columns chosen from a whitelist.

**Deliverables:** subjects and tasks endpoints matching `api-spec.md`.
**Testing:**
- CRUD happy path for subjects and tasks; data still present after restarting the server (FR-16).
- Validation: empty title, 151-character title, bad date such as `2026-02-30`, bad priority, `subjectId` of another user: 400.
- Bad IDs (`abc`, `0`, `-1`): 400. Missing ID: 404.
- **Isolation with two accounts (A and B):** B cannot get, edit, complete, or delete A's task or subject (404); B's list never contains A's data; B cannot create a task with A's `subjectId`.
- Unauthorized: every private route without a session returns 401.
- Delete a subject that has tasks: 409.
- Summary counts match the data; a completed task with a past due date is not overdue.
- Filters combine with AND; a hostile sort value such as `title; DROP TABLE tasks` is rejected; `' OR 1=1 --` in `q` returns no extra data.

**Deliverables check:** Tier 1 endpoints may be tagged separately if filters run late.
**Done when:** all cases pass and are logged, including the two-account isolation tests.
**Git checkpoints:** `feat(server): subjects API` then `feat(server): tasks API`, tag `cp3-api-complete` (or `cp3a-tasks-core` if filters are still pending).
**Docs updated:** `api-spec.md`, `database.md`, `security.md` evidence for S-2, S-3, S-9, `TESTING.md`, `TASKS.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`.
**Viva check:** can you explain why the task UPDATE includes `AND user_id = ?` and why a missing task and someone else's task both return 404?

### Phase 4: Client scaffold and authentication UI (T-060, T-070) | Sun 1 Nov
**Goal:** a React app that talks to the API through the Vite proxy and handles register, login, logout, and route protection.
**Depends on:** Phase 3 (at minimum Phase 2); approved client dependencies.

Tasks:
- [ ] Create `client/` with Vite + React; install `react-router-dom`; configure the `/api` proxy to port 3000 (D-015).
- [ ] `api/client.js` (the only `fetch` caller), `api/auth.js`, `context/AuthContext.jsx`, `ProtectedRoute`.
- [ ] Routes `/login`, `/register`, `/dashboard`, `/` redirect, not-found page.
- [ ] Login and register forms with per-field errors from the API; logout button.

**Deliverables:** working auth flow in the browser at `http://localhost:5173`.
**Testing:**
- With both servers running, the health endpoint is reachable via `http://localhost:5173/api/health`.
- Register, log in, refresh the page: still logged in (session restored by `/me`).
- Log out: redirected to `/login`; opening `/dashboard` redirects to `/login`.
- Wrong password shows the generic message; invalid fields show per-field messages.
- With the server stopped, the UI shows a readable error rather than a blank page.
- DevTools shows requests go to port 5173, with no CORS errors.

**Done when:** all checks pass and are logged.
**Git checkpoint:** `feat(client): scaffold React app and auth UI`, tag `cp4-auth-ui`.
**Docs updated:** README setup and scripts, `architecture.md` if the layout changed, `TESTING.md`, `TASKS.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`.
**Viva check:** can you explain the Vite proxy, why it removes the need for CORS, and why `ProtectedRoute` alone is not security?

### Phase 5: Dashboard UI (T-080) | Mon 2 Nov, finish Tue 3 Nov
**Goal:** the main screen, Tier 1 first, then Tier 2.
**Depends on:** Phases 3 and 4.

Tasks (in this order):
- [ ] `api/subjects.js`, `api/tasks.js`, `utils/dates.js`.
- [ ] Dashboard shell with the student's name and `SummaryCards`.
- [ ] `TaskList` and `TaskItem` (title, subject, due date, priority, status).
- [ ] `TaskForm` for create and edit with validation messages; `ConfirmDialog` for delete; complete toggle.
- [ ] `SubjectManager` (create, rename, delete with the 409 message shown).
- [ ] **Tier 2:** `FilterBar` (subject, priority, status, date range, search, sort) wired to the query parameters; overdue and due-soon indicators with a text label, not colour alone; "no tasks found" message.

**Deliverables:** a usable dashboard covering FR-4 to FR-13.
**Testing:**
- Create, edit, complete, un-complete, delete a task: list and summary update without a full page reload.
- Delete asks for confirmation; cancelling leaves the task.
- Create a task with a past due date: marked overdue with a text label; complete it: no longer overdue.
- Each filter alone, then combined; empty result shows the message.
- Title `<script>alert(1)</script>` appears as plain text and does not run (S-5).
- Log in as a second user: sees none of the first user's data.
- Refresh and restart the server: data persists.

**Done when:** Tier 1 passes by end of Mon 2 Nov, Tier 2 by end of Tue 3 Nov, all logged.
**Git checkpoints:** one commit per component group, tag `cp5-dashboard-core` (Tier 1) and `cp5-dashboard-full` (Tier 2).
**Docs updated:** `TESTING.md`, `TASKS.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`; `PRD.md` only if a Tier 3 trim was approved.
**Viva check:** can you explain how a state change in one component re-renders the list, and how filters become query parameters?

### Phase 6: Responsive design and polish (T-090) | Tue 3 Nov
**Goal:** usable at 360 px and on desktop (FR-14), with clear error and loading states. No new features.
**Depends on:** Phase 5.

Tasks:
- [ ] Check every page at 360 px and at desktop width using browser device mode.
- [ ] Fix horizontal scrolling, tiny tap targets, unreadable forms.
- [ ] Loading and error messages on every API call.
- [ ] Take screenshots for the report into `docs/evidence/`.

**Testing:** at 360 px: no horizontal scroll on login, register, dashboard; all buttons usable by touch; filters reachable. Repeat at desktop. If you can, open the app on a real phone on the same network (optional; needs the Vite dev server to be reachable from the network, which is an environment choice, not a project change).
**Done when:** the responsive cases in `TESTING.md` pass.
**Git checkpoint:** `style(client): responsive layout and polish`, tag `cp6-responsive`. **Feature freeze after this tag.**
**Docs updated:** `TESTING.md`, `TASKS.md`, `PROJECT_STATUS.md`, `CHANGELOG.md`.

### Phase 7: Testing and security review (T-100) | Tue 3 Nov evening to Wed 4 Nov
**Goal:** a complete, honest test record and a security checklist with evidence.
**Depends on:** Phase 6.

Tasks:
- [ ] Run every case in `TESTING.md` from a fresh browser session; record Pass/Fail, date, and notes. Fix failures and re-test.
- [ ] Walk the security table S-1 to S-9 and record evidence for each (screenshots or notes). S-10 stays a documented residual risk.
- [ ] Run `npm audit` in `server/` and `client/`; record the results. Do not mass-upgrade packages on the last day; record and explain anything left.
- [ ] Search the code for `console.log` of sensitive data and for string-built SQL.
- [ ] Review `git log` for any committed secret.

**Done when:** every test case has a recorded result, no known Tier 1 failure remains open, and the security checklist in `security.md` is ticked only where evidence exists.
**Git checkpoint:** `test: record manual test results and security evidence`, tag `cp7-tested`.
**Docs updated:** `TESTING.md`, `security.md`, `PROJECT_STATUS.md` (known issues listed honestly), `CHANGELOG.md`.

### Phase 8: Local demo readiness and final submission (T-110) | Wed 4 Nov to Thu 5 Nov
**Goal:** someone else can run the project from your repository, and you can present and defend it.
**Depends on:** Phase 7.

Tasks:
- [ ] **Clean-clone test:** clone the repo into a new folder and follow the README exactly (create DB, apply schema, `.env`, install both packages, start both servers). Fix the README wherever it was wrong, then mark the setup steps verified.
- [ ] **Production-style run (D-020):** run `npm run build` in `client/`, start the server, and confirm Express serves the built app and API on port 3000 (cases PROD-01 to PROD-03). Refreshing on `/dashboard` must still load the app. Use `NODE_ENV=development` for this local HTTP demo (see security.md section 2).
- [ ] If hosting was confirmed as required (OQ-11), do it now using the production settings in `security.md` section 2 (HTTPS, `secure` cookie, `trust proxy`). Otherwise skip: local demo is the plan.
- [ ] Add optional `server/sql/seed.sql` with clearly fake demo users, if you want demo data.
- [ ] Final doc consistency pass: the PRD, architecture, API spec, and database docs must match the code you actually have.
- [ ] Prepare the submission pack: GitHub repo link, README, SQL setup file, screenshots, test results, report.
- [ ] Rehearse the demo: register, add subjects, add tasks, filter, overdue, complete, delete, logout, second user isolation.
- [ ] Final `git status` clean, final tag, push.

**Done when:** the clean-clone setup works end to end, `PROJECT_STATUS.md` states exactly what is and is not working, and the final tag is pushed.
**Git checkpoint:** tag `cp8-final` (and `v1.0-submission` if you like). Submit on Thu 5 Nov.
**Docs updated:** all of them, finally. Remove "PLANNED" labels in the README only for things that are verified.

## 7. Viva preparation (a little each phase)
Keep a short list in your own words of: the folder structure and why it is split; the request path from a React click to a MySQL row and back; how passwords and sessions work; why queries are parameterized; why the server checks ownership; how the proxy works; how overdue is computed; and which risks remain (no rate limiting, no password reset, CSRF relies on SameSite). If you cannot explain a piece of code, ask me to walk you through it before the next phase.

## 8. Risks to the schedule
| Risk | Effect | Response |
|---|---|---|
| Approvals or version answers arrive late | Phase 1 cannot start | Defaults in DECISIONS are used; reply as early as possible on 28 Oct |
| MySQL or Node version problems | Lost hours on Thu 29 Oct | Record versions first; ask me for the smallest fix |
| API takes longer than planned | Delays the UI | Use the cut line (section 5); build Tier 1 before filters |
| Fewer study hours than assumed | Everything slips | Tell me early; trim Tier 3 with approval |
| Late bugs | Submission risk | Wed 4 Nov is buffer; no features after the Tue 3 Nov freeze |
| Docs drift from code | Viva and marks risk | Update docs at every checkpoint, not at the end |
